require('shelljs/global');

var async = require('async');
var jsonfile = require('jsonfile');
var path = require('path');
var argv = require('minimist')(process.argv.slice(2));

var utils = require('./utils');
var getRecentCommitForRepo = utils.getRecentCommitForRepo;
var formatDataForWritingToPackage = utils.formatDataForWritingToPackage;
var writeToPackage = utils.writeToPackage;
var getLatestCommitsForEachRepo = utils.getLatestCommitsForEachRepo;
var updatePackageVersionWithTag = utils.updatePackageVersionWithTag;
var createReleaseWithTheLatestTag = utils.createReleaseWithTheLatestTag;
var generateChangeLog = utils.generateChangeLog;
var filterCommitsToRemoveLastReleasedCommit = utils.filterCommitsToRemoveLastReleasedCommit;

var PROJECT_ROOT = '../frontend-web-server';
var packageData = jsonfile.readFileSync(`${PROJECT_ROOT}/package.json`);
var repos = [{
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

function init() {
  if (packageData.releases) {
    console.log('Already initialized.');
  } else {
    async.map(repos, getRecentCommitForRepo, (err, recentCommits) => {
      if (err) {
        console.log(err);
      } else {
        var data = formatDataForWritingToPackage(recentCommits);
        writeToPackage(data, packageData, (err) => {
          if (err) {
            console.log('Error initializing.');
          } else {
            commitPackageWithReleaseData();
          }
        });
      }
    });
  }
}

function release() {
  repos = repos.map((item) => {
    return Object.assign(item, {
      'since': packageData.releases[item.name].since
    });
  });

  var tag = packageData.version;
  updatePackageVersionWithTag(tag, 'patch', packageData, (err, packageData) => {
    tag = packageData.version;
    var projectRoot = path.resolve(PROJECT_ROOT);
    var commitCommand = exec(`cd ${PROJECT_ROOT} && git add package.json && git commit -m "Bump package version to ${tag} && git tag ${tag} && git push origin master --tags"`)
    if (commitCommand.code !== 0) {
      console.log('Error pushing changes', err);
    } else {
      async.map(repos, getLatestCommitsForEachRepo, (err, recentCommitsForAllRepos) => {
        if (err) {
          console.log(err);
        } else {
          recentCommitsForAllRepos = filterCommitsToRemoveLastReleasedCommit(recentCommitsForAllRepos, packageData)
          var changelog = generateChangeLog(recentCommitsForAllRepos);
          var repo = repos.filter((repo) => {
            return repo.main;
          });
          createReleaseWithTheLatestTag(repo[0], tag, changelog);
          updatePackageWithLatestReleaseInfo(recentCommitsForAllRepos, packageData, (err, packageData) => {
            commitPackageWithReleaseData();
          });
        }
      });
    }
  });
}

function commitPackageWithReleaseData() {
  var commitCommand = exec(`cd ${PROJECT_ROOT} && git add package.json && git commit -m "Update package with release info" && git push origin master`);
  if (commitCommand.code !== 0) {
    console.log('Error commiting release info');
  }
}

if (argv.i) {
  init();
} else if (argv.r) {
  release();
} else {
  console.log('Option not recognized.');
}