# :rocket: simple-release

**An npm module for managing release of nested projects**

[![Dependency Status](https://david-dm.org/karanjthakkar/simple-release.svg)](https://david-dm.org/karanjthakkar/simple-release)

# Why

This was built out of my personal frustration in manually writing changelogs for our project releases. What we have is multiple repositories for different projects and a base repository where all the code is combined before release. Instead of maintaing changelog's for tens of different projects in their own github releases, what this does is combine the latest commits of the base project and all dependent projects and combine them into one changelog, which is used to maintained in the release of the base repository.


# Example

Lets say you have a `Project Base`. There is `SubProject 1` and `SubProject 2` which are included within `Project Base` before release. What `simple-release` aims to do is generate a changelog for each: `Project Base`, `SubProject 1` and `SubProject 2`. This is then used to create a tagged release in github.

# How it works / Setup

Install this module using: `npm install -g simple-release`

## Step 1: 

This releases needs access to your github account for creating releases and writing to your project repository. So you will need to create and add your github token to the environment variable `GITHUB_TOKEN`. For more info, check [this article](https://help.github.com/articles/creating-an-access-token-for-command-line-use/)

## Step 2:

Go to your base project and type: 

`$ simple init`

This will interactively help you setup your project for use with this module.

![Setup screenshot](https://raw.githubusercontent.com/karanjthakkar/simple-release/master/setup.png)

Thats it. You're all set to start doing hassle free releases!


## How to Release

Go to your base project and type: 

```
/* Run for every subsequent releases
 * 'type' is a semver release type
 * Suported values for type: major, premajor, minor, preminor, patch, prepatch, or prerelease
 * Default type is 'patch'
 */
$ simple release <type>
```

This will: 

1. pick all the latest commits since the last release for your base project and all your sub-projects 
2. create a new semver tag based on the release type
3. update your package.json with the new tag
4. create a tagged release with a changelog


## Contributions

Suggestions/ideas on how to make it better are most welcome. :)