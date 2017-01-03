const request = require('request');
const cheerio = require('cheerio');
const URL = require('url-parse');
const fs = require('fs');
const nconf = require('nconf');

var searchableUrl = '';
var wordsToSearch =  [];
var maxPagesToVisit = 10000;
var urlMustContain =  '';
var fileName = '';
var pagesVisited = {};
var numPagesVisited = 0;
var pagesToVisit = [];
var url = undefined;
var baseUrl = '';
var data = { "all" : []};
var exitCrawl = undefined;

function initiateCrawl(config, callback) {
    if (!config) return callback();

    searchableUrl = config.searchableUrl;
    wordsToSearch =  config.wordsToSearch;
    maxPagesToVisit = Math.max(1, Math.min(10000,config.maxPagesToVisit));
    urlMustContain =  config.urlToSaveContains;
    pagesToVisit =  config.urlsToSearch;

    if (!searchableUrl) return callback();
    if (!urlMustContain) return callback();
    if (!wordsToSearch || wordsToSearch.length === 0) return callback();
    if (!pagesToVisit || pagesToVisit.length === 0) return callback();

    pagesVisited = {};
    numPagesVisited = 0;
    var startUrl  = pagesToVisit[0];
    url = new URL(startUrl);
    baseUrl = url.protocol + "//" + url.hostname;
    pagesToVisit.push(startUrl);
    fileName = config.fileToSaveData;

    data = { "all" : []};

    for (var i = 0; i < wordsToSearch.length; i++) {
        data[wordsToSearch[i]] = [];
    }

    exitCrawl = function () {
        saveToFile(callback);
    };

    crawl();
}

function crawl() {
    if(numPagesVisited >= maxPagesToVisit) {
        console.log("Reached max limit of number of pages to visit.");
        exitCrawl();
        return;
    }

    if(pagesToVisit.length == 0){
        console.log("EXIT");
        exitCrawl();
        return;
    }
    var nextPage = pagesToVisit.pop();
    if (nextPage in pagesVisited) {
        // We've already visited this page, so repeat the crawl
        crawl();
    } else {
        // New page we haven't visited
        visitPage(nextPage, crawl);
    }
}

function visitPage(url, callback) {
    visitPageHelper(url, callback, function ($) {
        var links = collectInternalLinks($);
        searchInPage(links,  callback);
    });
}

function searchForWord($, word) {
    var bodyText = $('html > body').text().toLowerCase();
    return(bodyText.indexOf(word.toLowerCase()) !== -1);
}

function collectInternalLinks($) {
    var relativeLinks = $("a[href^='/']");
    var links = [];
    relativeLinks.each(function() {
        var url = baseUrl + $(this).attr('href');
        if((isASearchableURL(url) || isValidLink(url)) && pagesToVisit.indexOf(url) == -1){
            pagesToVisit.push(url);
            links.push(url);
        }
    });
    return links;
}

function visitSinglePage(url, callback) {
    visitPageHelper(url,  callback);
}

function visitPageHelper(url,  callback, callbackNotValidLink){
    // Add page to our set
    pagesVisited[url] = true;
    numPagesVisited++;

    // Make the request
    request(url, function(error, response, body) {
        // Check status code (200 is HTTP OK)
        if(response.statusCode !== 200) {
            return callback();
        }

        // Parse the document body
        var $ = cheerio.load(body);
        if(isValidLink(url)){
            var save = true;
            for (var i = 0 ; i < wordsToSearch.length; i++){
                var word = wordsToSearch[i];
                var isWordFound = searchForWord($, word);
                save = (isWordFound && save);
                if(isWordFound) {
                    data[word].push(url);
                }
            }

            if (save) {
                data['all'].push(url);
            }
        }
        else {
            if (callbackNotValidLink) {
                return callbackNotValidLink($);
            }
        }
        // In this short program, our callback is just calling crawl()
        callback();
    });
}

function searchInPage(links, callback){
    if(links.length == 0){
        return callback();
    }
    visitSinglePage(links.shift(), function(){
        searchInPage(links, callback);
    });
}

function isASearchableURL(url){
    return !searchableUrl || url.indexOf(searchableUrl) > -1;
}

function isValidLink(url){
    return !urlMustContain || url.indexOf(urlMustContain) > -1;
}


function saveToFile(callback){

    if (!fileName) return;
    fs.writeFile(fileName, JSON.stringify(data), function(err) {
        if(err) {
            return console.log(err);
        }

        console.log("The file was saved!");
        callback();
    });
}

module.exports = {
    initiateCrawl : initiateCrawl
};
