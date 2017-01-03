var nconf = require('nconf');
var base = require('./base');

nconf.argv().env().file({ file: './config.json' });

var configs = nconf.get('sites');

function crawlThroughSites() {
    if (configs && configs.length > 0){
        var config = nconf.get(configs.shift());
        base.initiateCrawl(config, crawlThroughSites);
    }
}

crawlThroughSites();
