var async = require('async');
var jsonfile = require('jsonfile');
var utils = require('./utils');
var getRecentCommitForRepo = utils.getRecentCommitForRepo;
var formatDataForWritingToPackage = utils.formatDataForWritingToPackage;
var writeToPackage = utils.writeToPackage;

function init() {
  var repos = [ {
    user: 'Codigami',
    name: 'frontend-web-server',
    main: true
  }, {
    user: 'Codigami',
    name: 'cfcore-frontend',
    main: false
  }, {
    user: 'Codigami',
    name: 'publish-frontend',
    main: false
  }, {
    user: 'Codigami',
    name: 'publish-web-standalone',
    main: false
  }, {
    user: 'Codigami',
    name: 'Crowdfire-Frontend',
    main: false
  }, {
    user: 'Codigami',
    name: 'cf-web-2.0',
    main: false
  }];
  var oldPackageData = jsonfile.readFileSync('../frontend-web-server/package.json');

  if (oldPackageData.releases) {
    console.log('Already initialized');
  } else {
    async.map(repos, getRecentCommitForRepo, (err, recentCommits) => {
      if (err) {
        console.log(err);
      } else {
        var data = formatDataForWritingToPackage(recentCommits);
        writeToPackage(data, oldPackageData);
      }
    });
  }
};

function release() {
  var repos = [ {
    user: 'Codigami',
    name: 'frontend-web-server',
    main: true
  }, {
    user: 'Codigami',
    name: 'cfcore-frontend',
    main: false
  }, {
    user: 'Codigami',
    name: 'publish-frontend',
    main: false
  }, {
    user: 'Codigami',
    name: 'publish-web-standalone',
    main: false
  }, {
    user: 'Codigami',
    name: 'Crowdfire-Frontend',
    main: false
  }, {
    user: 'Codigami',
    name: 'cf-web-2.0',
    main: false
  }];
  var oldPackageData = jsonfile.readFileSync('../frontend-web-server/package.json');
  repos = repos.map((item) => {
    return Object.assign(item, {
      'sha': oldPackageData.releases[item.name].lastSHA
    });
  });
  
  async.map(repos, getLatestCommitsForEachRepo, (err, recentCommits) => {
    if (err) {
      console.log(err);
    } else {
      // var changelog = generateChangeLog(recentCommits);
      var tag = oldPackageData.version;
      updatePackageVersionWithTag(tag, oldPackageData);
      // stagePackageChanges();
      // commitPackageChanges(`Bump package version to ${tag}`);
      // createNewGitTag(tag);
      // pushGitTagToGithub(tag);
      // createReleaseWithTheLatestTag(tag, changelog);
    }
  });
};

init();