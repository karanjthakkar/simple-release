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
var filterCommitsToRemoveRedundantCommits = utils.filterCommitsToRemoveRedundantCommits;
var updatePackageWithLatestReleaseInfo = utils.updatePackageWithLatestReleaseInfo;
var hasNoUpdatesInAnyRepo = utils.hasNoUpdatesInAnyRepo;

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

  async.waterfall([
    function fetchCommitsSinceLastRelease(cb) {
      console.log('Fetching commits for all projects.');
      async.map(repos, getLatestCommitsForEachRepo, (err, recentCommitsForAllRepos) => {
        if (err) {
          console.log('Error fetching new commits', err);
          cb(err);
        } else {
          console.log('Filtering commits.');
          var allUnreleasedCommits = filterCommitsToRemoveLastReleasedCommit(recentCommitsForAllRepos, packageData);
          var filteredUnreleasedCommits = filterCommitsToRemoveRedundantCommits(recentCommitsForAllRepos);
          if (hasNoUpdatesInAnyRepo(filteredUnreleasedCommits)) {
            cb('No updates available in any projects.');
          } else {
            cb(null, allUnreleasedCommits);
          }
        }
      });
    },
    function updatePackageJsonBeforeRelease(recentCommitsForAllRepos, cb) {
      var currentVersion = packageData.version;
      console.log(`Updating package version. Current package version: ${currentVersion}.`);
      updatePackageVersionWithTag(currentVersion, 'patch', packageData, (err, packageData) => {
        console.log(`Package updated to ${packageData.version}.`);
        cb(null, recentCommitsForAllRepos, packageData);
      });
    },
    function pushUpdatedPackageJsonWithTags(recentCommitsForAllRepos, packageData, cb) {
      console.log('Pushing updated package.');
      var currentVersion = packageData.version;
      var projectRoot = path.resolve(PROJECT_ROOT);
      var commitCommand = exec(`cd ${PROJECT_ROOT} && git add package.json && git commit -q -m "Bump package version to ${currentVersion}" && git tag ${currentVersion} && git push origin master -q --tags`)
      console.log('Pushed updated package.');
      if (commitCommand.code !== 0) {
        console.log('Error pushing changes');
        cb(true);
      } else {
        cb(null, recentCommitsForAllRepos, packageData);
      }
    },
    function generateChangelog(recentCommitsForAllRepos, packageData, cb) {
      console.log('Generating changelog.');
      var filteredUnreleasedCommits = filterCommitsToRemoveRedundantCommits(recentCommitsForAllRepos);
      var changelog = generateChangeLog(filteredUnreleasedCommits);
      console.log('Changelog: \n', changelog);
      cb(null, recentCommitsForAllRepos, packageData, changelog);
    },
    function createRelease(recentCommitsForAllRepos, packageData, changelog, cb) {
      console.log('Creating release.');
      var repo = repos.filter((repo) => {
        return repo.main;
      });
      var currentVersion = packageData.version;
      createReleaseWithTheLatestTag(repo[0], currentVersion, changelog);
      cb(null, recentCommitsForAllRepos, packageData);
    },
    function updateAndPushPackageWithNewReleaseInfo(recentCommitsForAllRepos, packageData, cb) {
      console.log('Update package with the lastest release info.');
      updatePackageWithLatestReleaseInfo(recentCommitsForAllRepos, packageData, (err, packageData) => {
        console.log('Pushing updated release info.');
        commitPackageWithReleaseData(null, packageData);
      });
    }
  ], function(err, packageData) {
      if (err) {
        console.log('Release aborted.', err);
      } else {
        var currentVersion = packageData.version;
        console.log(`Release complete. Latest version: ${currentVersion}`);
      }
  });
}

function commitPackageWithReleaseData() {
  var commitCommand = exec(`cd ${PROJECT_ROOT} && git add package.json && git commit -q -m "Update package with release info" && git push origin master -q`);
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