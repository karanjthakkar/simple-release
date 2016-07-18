var jsonfile = require('jsonfile');
var semver = require('semver');
var GitHubApi = require('github');
var github = new GitHubApi({
  'timeout': 5000
});

var PROJECT_ROOT = '../frontend-web-server';

github.authenticate({
  'type': 'oauth',
  'token': process.env.GITHUB_TOKEN
});

function getRecentCommitForRepo(repo, callback) {
  github.repos.getCommits({
    'per_page': 1,
    'user': repo.user,
    'repo': repo.name
  }, function(err, res) {
    if (err) {
      callback(err);
    } else {
      callback(null, res && {
        'repo': {
          'name': repo.name,
          'user': repo.user
        },
        'sha': res[0].sha,
        'author': res[0].author.login,
        'message': res[0].commit.message,
        'since': res[0].commit.author.date
      } || {});
    }
  });
}

function getLatestCommitsForEachRepo(repo, callback) {
  github.repos.getCommits({
    'per_page': 100,
    'since': repo.since,
    'user': repo.user,
    'repo': repo.name
  }, function(err, commits) {
    if (err) {
      callback(err);
    } else {
      commits = commits.map((commit) => {
        return {
          'sha': commit.sha,
          'author': commit.author ? commit.author.login : commit.commit.author.name,
          'message': commit.commit.message,
          'since': commit.commit.author.date
        };
      });
      callback(null, {
        'repo': {
          'name': repo.name,
          'user': repo.user
        },
        'commits': commits
      });
    }
  });
}

function formatDataForWritingToPackage(data) {
  var returnObj = {};
  data.forEach((item) => {
    returnObj[item.repo.name] = {
      'lastSHA': item.sha,
      'since': item.since,
      'message': item.message
    }
  });
  return {
    'releases': returnObj
  };
}

function writeToPackage(data, packageData, callback) {
  data = Object.assign(packageData, data);
  jsonfile.writeFile(`${PROJECT_ROOT}/package.json`, data, {
    'spaces': 2
  }, (err) => {
    if (err) {
      console.error(err);
      callback(err);
    } else {
      console.error('Write Successful');
      callback(null, data);
    }
  });
}

function updatePackageVersionWithTag(tag, type, packageData, callback) {
  var newTag = semver.inc(tag, type);
  data = {
    'version': newTag
  };
  writeToPackage(data, packageData, callback);
}

function updatePackageWithLatestReleaseInfo(recentCommitsForAllRepos, packageData, callback) {
  var data = {
    'releases': {}
  };
  recentCommitsForAllRepos.forEach((recentCommitsForARepo) => {
    if (recentCommitsForARepo.commits.length > 0) {
      var commit = recentCommitsForARepo.commits[0];
      commit.message = commit.message.split(/\n|\r/gi)[0];
      data.releases[recentCommitsForARepo.repo.name] = {
        'lastSHA': commit.sha,
        'since': commit.since,
        'message': commit.message
      };
    } else {
      data.releases[recentCommitsForARepo.repo.name] = packageData.releases[recentCommitsForARepo.repo.name];
    }
  });
  writeToPackage(data, packageData, callback);
}

function createReleaseWithTheLatestTag(repo, tag, changelog) {
  github.repos.createRelease({
    'user': repo.user,
    'repo': repo.name,
    'tag_name': tag,
    'name': `Release ${tag}`,
    'body': changelog
  });
}

function generateChangeLog(recentCommitsForAllRepos) {
  var message = '';
  recentCommitsForAllRepos.forEach((recentCommitsForARepo) => {
    if (recentCommitsForARepo.commits.length > 0) {
      message += `# ${recentCommitsForARepo.repo.name} \n\n`
      recentCommitsForARepo.commits.forEach((commit) => {
        commit.message = commit.message.split(/\n|\r/gi)[0];
        message += `- ${commit.message} - @${commit.author} (${recentCommitsForARepo.repo.user}/${recentCommitsForARepo.repo.name}@${commit.sha}) \n`
      });
      message += '\n\n';
    }
  });
  return message;
}

function filterCommitsToRemoveLastReleasedCommit(recentCommitsForAllRepos, packageData) {
  return recentCommitsForAllRepos.map((recentCommitsForARepo) => {
    recentCommitsForARepo.commits = recentCommitsForARepo.commits.filter((commit) => {
      return packageData.releases[recentCommitsForARepo.repo.name].lastSHA !== commit.sha;
    });
    return recentCommitsForARepo;
  });
}

function hasNoUpdatesInAnyRepo(recentCommitsForAllRepos) {
  var totalCommits = 0;
  recentCommitsForAllRepos.forEach((recentCommitsForARepo) => {
    totalCommits += recentCommitsForARepo.commits.length;
  });
  return totalCommits === 0;
}

function filterCommitsToRemoveRedundantCommits(recentCommitsForAllRepos) {
  const redundantStrings = ['Bump package version to', 'Update package with release info'];
  return recentCommitsForAllRepos.map((recentCommitsForARepo) => {
    recentCommitsForARepo.commits = recentCommitsForARepo.commits.filter((commit) => {
      var isRedundant = false;
      redundantStrings.forEach((item) => {
        if (!isRedundant && commit.message.indexOf(item) > -1) {
          isRedundant = true;
        }
      });
      return !isRedundant;
    });
    return recentCommitsForARepo;
  });
}

module.exports = {
  getRecentCommitForRepo,
  getLatestCommitsForEachRepo,
  formatDataForWritingToPackage,
  writeToPackage,
  updatePackageVersionWithTag,
  createReleaseWithTheLatestTag,
  generateChangeLog,
  filterCommitsToRemoveLastReleasedCommit,
  updatePackageWithLatestReleaseInfo,
  hasNoUpdatesInAnyRepo,
  filterCommitsToRemoveRedundantCommits
};