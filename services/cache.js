const mongoose = require('mongoose');
const redis = require('redis')
const redisURL = 'redis://127.0.0.1:6379'
const client = redis.createClient(redisURL)
const util = require('util');
client.hget = util.promisify(client.hget);

const exec = mongoose.Query.prototype.exec;

//toggleable cache
mongoose.Query.prototype.cache = function(options={}){
    this.useCache = true;
    this.hashKey = JSON.stringify(options.key || '');
    return this;
}


mongoose.Query.prototype.exec = async function(){
    if(!this.useCache) return exec.apply(this,arguments);
   const key = JSON.stringify(
       Object.assign({},this.getQuery(),
       {collection:this.collation().mongooseCollection.collectionName}));
// DO WE HAVE ANY CACHED REDIS DATA FOR QUERY
    const cacheValue = await client.hget(this.hashKey,key);
//IF YES, SEND THE DATA
    if(cacheValue){ 
      const doc = JSON.parse(cacheValue);
      return Array.isArray(doc) ? doc.map(dc=>new this.model(dc))
      : new this.model(doc);
    }

//IF NO RESPOND TO REQUEST WITH MONGO AND UPDATE CACHE
    const result = await exec.apply(this,arguments);
    client.hset(this.hashKey,key,JSON.stringify(result),
    //WITH EXPIRATION TIME
    // (err,reply)=>
    // {
    //     client.expire(this.hashKey,10)
    // }
    
    )
    

    return result;
}


module.exports = {
    clearHash(hashKey){
     client.del(JSON.stringify(hashKey));
    }
}