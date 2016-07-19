require('shelljs/global');

var async = require('async');
var jsonfile = require('jsonfile');
var path = require('path');
var inquirer = require('inquirer');
var gh = require('parse-github-url');
var isGithubUrl = require('is-github-url');

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

var repos = [];

function askForMainProject(cb) {
  inquirer.prompt([{
    name: 'mainProjectUrl',
    message: 'Enter the url of your project\'s github repository: ',
    validate: function(input) {
      const isValidUrl = isGithubUrl(input, {
        repository: true
      });
      return isValidUrl || 'Please enter a valid git url';
    }
  }]).then(function(answers) {
    const parsedGithubUrl = gh(answers.mainProjectUrl);
    repos.push({
      'user': parsedGithubUrl.owner,
      'name': parsedGithubUrl.name,
      'main': true
    });
    cb();
  });
}

function confirmAnyDependentProjects(cb) {
  inquirer.prompt([{
    type: 'confirm',
    name: 'hasMoreDependentProjects',
    message: 'Do you have any more dependent projects: '
  }]).then(function(answers) {
    if (answers.hasMoreDependentProjects) {
      cb();
    } else {
      cb('skip');
    }
  });
}

function askForDependentProjects(cb) {
  inquirer.prompt([{
    name: 'dependentProjectUrl',
    message: 'Enter the url of your project\'s github repository: ',
    validate: function(input) {
      const isValidUrl = isGithubUrl(input, {
        repository: true
      });
      return isValidUrl || 'Please enter a valid git url';
    }
  }, {
    type: 'confirm',
    name: 'hasMoreDependentProjects',
    message: 'Do you have any more dependent projects: '
  }]).then(function(answers) {
    const parsedGithubUrl = gh(answers.dependentProjectUrl);
    repos.push({
      'user': parsedGithubUrl.owner,
      'name': parsedGithubUrl.name,
      'main': true
    });
    if (answers.hasMoreDependentProjects) {
      askForDependentProjects(cb);
    } else {
      cb();
    }
  });
}

function setup(cb) {
  async.waterfall([
    askForMainProject,
    confirmAnyDependentProjects,
    askForDependentProjects
  ], function(err) {
    if (err && err !== 'skip') {
      cb(err);
    } else {
      cb();
    }
  });
}

function initializeProject(cb) {
  console.log('Initializing project.');
  var packageData = jsonfile.readFileSync(`${process.cwd()}/package.json`);
  console.log('Fetching latest commits.');
  async.map(repos, getRecentCommitForRepo, (err, recentCommits) => {
    if (err) {
      cb(err);
    } else {
      console.log('Updating package with latest release info.');
      var data = formatDataForWritingToPackage(repos, recentCommits);
      writeToPackage(data, packageData, (err) => {
        if (err) {
          cb(err);
          console.log('Error initializing.');
        } else {
          console.log('Pushing package with latest release info.');
          commitPackageWithReleaseData();
          cb();
        }
      });
    }
  });
}

function init() {
  async.series([
    setup,
    initializeProject
  ], function(err) {
    if (err) {
      console.log('Error initializing ', err);
    } else {
      console.log('Setup and initialization complete. \nYou can now type \'simple release\' whenever you want to create and publish a release.');
    }
  });
}

function release(releaseType) {
  var packageData = jsonfile.readFileSync(`${process.cwd()}/package.json`);
  var repos = packageData['simple-release'].config;

  repos = repos.map((item) => {
    return Object.assign(item, {
      'since': packageData['simple-release'].releases[item.name].since
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
      updatePackageVersionWithTag(currentVersion, releaseType, packageData, (err, packageData) => {
        console.log(`Package updated to ${packageData.version}.`);
        cb(null, recentCommitsForAllRepos, packageData);
      });
    },
    function pushUpdatedPackageJsonWithTags(recentCommitsForAllRepos, packageData, cb) {
      console.log('Pushing updated package.');
      var currentVersion = packageData.version;
      var projectRoot = path.resolve(process.cwd());
      var commitCommand = exec(`cd ${process.cwd()} && git add package.json && git commit -q -m "Bump package version to ${currentVersion}" && git tag ${currentVersion} && git push origin master -q --tags`)
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
  var commitCommand = exec(`cd ${process.cwd()} && git add package.json && git commit -q -m "Update package with release info" && git push origin master -q`);
  if (commitCommand.code !== 0) {
    console.log('Error commiting release info');
  }
}

module.exports = {
  init,
  release
};
