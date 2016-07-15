var jsonfile = require('jsonfile');
var GitHubApi = require('github');
var github = new GitHubApi({
  'timeout': 5000
});

github.authenticate({
  'type': 'oauth',
  'token': '434bd8a928c1c856c51080f7b8fe3596fdc7e59b'
});

exports.getRecentCommitForRepo = function getRecentCommitForRepo(repo, callback) {
  github.repos.getCommits({
    'per_page': 2,
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
        'sha': res[1].sha,
        'shaUrl': res[1].url,
        'author': res[1].author.login,
        'authorUrl': res[1].author.html_url,
        'message': res[1].commit.message
      } || {});
    }
  });
};

exports.getLatestCommitsForEachRepo = function getLatestCommitsForEachRepo(repo, callback) {
  github.repos.getCommits({
    'per_page': 100,
    'sha': repo.sha,
    'user': repo.user,
    'repo': repo.name
  }, function(err, commits) {
    if (err) {
      callback(err);
    } else {
      res = commits.map((commit) => {
        return {
          'sha': commit.sha,
          'shaUrl': commit.url,
          'author': commit.author.login,
          'authorUrl': commit.author.html_url,
          'message': commit.commit.message
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
};

exports.formatDataForWritingToPackage = function formatDataForWritingToPackage(data) {
  var returnObj = {};
  data.forEach((item) => {
    returnObj[item.repo.name] = {
      'lastSHA': item.sha
    }
  });
  return {
    'releases': returnObj
  };
};

exports.writeToPackage = function writeToPackage(data, oldPackageData) {
  data = Object.assign(oldPackageData, data);
  jsonfile.writeFile('../frontend-web-server/package.json', data, {
    'spaces': 2
  }, (err) => {
    if (err) {
      console.error(err)
    } else {
      console.error('Write Successful');
    }
  });
};

exports.updatePackageVersionWithTag = function updatePackageVersionWithTag(tag, oldPackageData) {
  var newTag = semver.inc(tag, 'minor');
  data = {
    'version': newTag
  };
  writeToPackage(data, oldPackageData);
};