//================== Load modules start ====================================
let express 	= require('express'),
    fs			= require('fs'),
    request 	= require('request'),
    cheerio 	= require('cheerio'),
    csv 		= require('csvtojson'),
    rp 			= require('request-promise'),
    parse 		= require('csv-parse'),
    constants 	= require('./constants.js')
    db          = require('./dao.js'),
    app 		= express();

// DB Configuration
db.init();

let missingEntries = {};
let finalStateJsonArray = [];

//================== Main Function Start =====================================
startScraping().then(result => {
    console.log('COMPLETED!!!!!');
});
//================= Main Function End ========================================

//================= Helper Functions Start====================================

async function startScraping() {
    let files = [];

    //read from the CSV file & store it.
    let output = await getCSVRecordsFromFiles();
    getCompaniesRecordByState(output);
}

async function getCSVRecordsFromFiles(){
    let output = {};
    return new Promise(async (resolve, rej) => {

        //Getting all files in specified folder
        let filesList = await getFilesFromFolder(constants.FILES_BASE_PATH);
        let stateOutput = {};

        //Iterate through all files and putting data in Object.
        for(let fileName of filesList) {
            let stateName = fileName.split('_').reverse()[0].replace('.csv','');
            console.log('Getting data for ' + stateName);

            //Creating Json file to store the parsed data
            let jsonFile = fs.openSync(constants.JSON_FILES_BASE_PATH + stateName + '.json', 'w');

            let result = await readFileCSV(fileName);
            stateOutput[stateName] = result;
        }
        resolve(stateOutput);
    })
}

async function getCompaniesRecordByState(records){
    let jsonFileArray = [];
    missingEntries = {};

    for(state in records) {
        jsonFileArray = [];
        console.log('Parsing.....', state);
        let element = records[state];
        let loopcounter = 0;
        for(urnId of element) {
            //Passing the URN to get the final output
            let finalJson = await getPageDetailsUsingUrnId( urnId );
            let inc = {};
            let mergedObject={};
            if(finalJson) {
                finalJson.forEach(function (tableData) {
                    mergedObject = Object.assign(inc, tableData);
                });
                console.log(state + '  --  ' + loopcounter);
                if (inc) {
                    finalStateJsonArray.push({State: state, Json: mergedObject});
                    jsonFileArray.push( mergedObject );
                }
            }
            else {
                //console.log('Not worked for : ', urnId);
                //Pushing the URNID of company for which the data has not came. Need to retry it.
                missingEntries[state] = missingEntries[state] || [];
                missingEntries[state].push(urnId);
            }
            loopcounter++;
        }

        //Appending data to json file. Will iterate through it to insert data into database.
        fs.appendFile(constants.JSON_FILES_BASE_PATH + state + '.json', (JSON.stringify( jsonFileArray )));
    }

    checkAndRunMissingEntries();
}

async function checkAndRunMissingEntries(){

    // Checking the missing entries (if any) and re-attempt
    if (Object.keys(missingEntries).length > 0){
        getCompaniesRecordByState( missingEntries );
    } else {
        //ready to insert into database
        let filesList = await getFilesFromFolder(constants.JSON_FILES_BASE_PATH);

        for(let stateName of filesList) {
            let finalStateArray = [];
            let filePath = constants.JSON_FILES_BASE_PATH + stateName;
            let contents = fs.readFileSync(filePath);
            let fileData = JSON.parse(contents);
            fileData.forEach( data => {
                finalStateArray.push(data);
            });
            let actualStateName = stateName.substring(0,stateName.length - 5);
            db.insert(finalStateArray, actualStateName);
        }
    }
}

function getFilesFromFolder( path ){
    //Getting all files in specified folder
    return new Promise((res, rej) => {
        fs.readdir(path, (err, data) => {
            return res(data);
        });
    });
}

function readFileCSV(fileName){

    // Reading CSV file and return it in form of Array
    return new Promise((resolve, rej) => {
        let arr = [];
        let filePath = constants.FILES_BASE_PATH + fileName;

        fs.readFile(filePath, (err, fileData) => {
            let output = [];
            parse(fileData, {}, (err, rows) => {
                delete rows[0];
                rows.forEach((row) => {
                    output.push(row[0]);
                });
                return resolve(output);
            })
        })
    })
}

function getPageDetailsUsingUrnId(urnId) {

    // Getting the final page to get the data
    //console.log('URN-ID:', urnId);
    let url = constants.LINKS.COMPANY_DATA_URL + urnId;
    let options = {
        uri: url,
        transform: function (html) {
            return cheerio.load(html);
        }
    };

    return rp(options).then(function ($) {
        let tableDataArray = [],
            data;
        $('.company-data.uppercase').filter(function( item, index ) {
            let tableName = $(this).text().replace(/\s+/g, '_').toLowerCase();
            // Getting the Json data from different tables/divs with in the web page
            switch ( tableName ){
                case constants.KEYWORDS.COMPANY_DETAILS:
                    data = $(this).next().html();
                    tableDataArray.push( getJsonFromTable( data, $ ) );
                    break;
                case constants.KEYWORDS.SHARE_CAPITAL:
                    data = $(this).next().html();
                    tableDataArray.push( getJsonFromTable( data, $ ) );
                    break;
                case constants.KEYWORDS.ANNUAL_COMPLIANCE_DETAILS:
                    data = $(this).next().html();
                    tableDataArray.push( getJsonFromTable( data, $ ) );
                    break;
                case constants.KEYWORDS.CONTACT_DETAILS:
                    data = $(this).next().html();
                    tableDataArray.push( getJsonFromDiv( data, $ ) );
                    break;
                case constants.KEYWORDS.DIRECTOR_DETAILS:
                    data = $(this).next().html();
                    tableDataArray.push( getDirectorDetails( data, $ ) );
                    break;
                default:
                    break;
            }
        });
        return tableDataArray;
    })
        .catch(function (err) {
            console.log(err);
        });
}

function getDirectorDetails( data, $ ){

    // Getting Director details from web page
    let object = {},
        directorNames = '';

    $( data ).children("tbody tr").map(function() {
        x = $(this).children();
        x.each(function( inc ) {
            if ( inc === 1 && $(this).text() !== undefined ){
                directorNames += $(this).text().trim() +',';
            }
            inc++;
        });
    });

    object['directors'] = directorNames.substring( 0, directorNames.length -1 );
    return object;
}

function getJsonFromTable( data, $ ){
    // Getting data from web page given in form of table
    let object = {};
    $( data ).children("tr").map(function(){
        let itArr = [];
        x = $( this ).children();
        x.each(function( inc ){
            if( $(this).text() ){
                let tableValue = $(this).text().replace(/\s+/g, '_').toLowerCase();
                if ( inc === 0 ) {
                    itArr.push( tableValue );
                } else {
                    itArr.push( $(this).text().replace("₹", "") );
                }
            }
            inc++;
        });
        object[ itArr[0] ]  =  itArr[1]
    }).get();
    return object;
}

function getJsonFromDiv( data, $ ){

    // Getting data from web page given in form of div
    let object = {};
    $( data ).map(function(){
        x = $(this).children();
        x.each(function( inc ) {
            let contactDetailDataArray = $(this).text().split(':');
            if( inc === 0 || inc === 1 ){
                if( contactDetailDataArray[1] !== undefined ){
                    let key = contactDetailDataArray[0].replace(/\s+/g, '_').toLowerCase();
                    object[key] = contactDetailDataArray[1]
                }
            } else if( inc === 3 ){
                object['address'] = contactDetailDataArray[0]
            } else {
                //console.log('No data found.')
            }
            inc++;
        });
    });
    return object;
}


//================= Helper Functions End======================================

app.set('PORT_NAME', constants.PORT);
app.listen(app.get('PORT_NAME'));

console.log('Magic happens on port', app.get('PORT_NAME'));

exports = module.exports = app;