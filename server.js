let express 	= require('express'),
	fs			= require('fs'),
	request 	= require('request'),
	cheerio 	= require('cheerio'),
	app 		= express(),
	csv 		= require('csvtojson'),
	rp 			= require('request-promise'),
	parse 		= require('csv-parse'),
	constants 	= require('./constants.js'),
    Sequelize 	= require('sequelize');

const sequelize = new Sequelize('webcrawler', 'root', 'admin', {
    host: 'localhost',
    dialect: 'mysql',
    operatorsAliases: false
});

let BASE_URL = constants.BASE_URL;
let DownloadedFilesPath = constants.DownloadedFilesPath;

console.time('TIME-TO-SCRAPE');

startScraping().then(result => {
	console.log('COMPLETED!!!!!');
	console.timeEnd('TIME-TO-SCRAPE');
})

// getPageDetailsUsingUrnId('U00303BR1990PTC003708').then((data) => {debugger;});
// getPageDetailsUsingUrnId('U00500BR1983PTC001875').then((data) => {debugger;});
// getPageDetailsUsingUrnId('U00500BR1983PTC001885').then((data) => {debugger;});
// getPageDetailsUsingUrnId('U00500BR1983PTC001893').then((data) => {debugger;});
// getPageDetailsUsingUrnId('U00500BR1983PTC001894').then((data) => {debugger;});

function getFilesFromFolder(){
    return new Promise((res, rej) => {
         fs.readdir('./downloaded_files/', (err, data) => {
         	return res(data);
		 });
    });
}

function readFileCSV(fileName){
	return new Promise((resolve, rej) => {
		let arr = [];
		let filePath = './downloaded_files/' + fileName;
		
		fs.readFile(filePath, (err, fileData) => {
			let output = [];
			parse(fileData, {}, (err, rows) => {
				delete rows[0];
				console.log('Testttttt')
				rows.forEach((row) => {
					output.push(row[0]);
				});
				return resolve(output);
			})
		})
	 })
}

async function getCSVRecordsFromFiles(){
	let output = {};
	return new Promise(async (resolve, rej) => {

		let filesList = await getFilesFromFolder();
		let stateOuput = {};
		for(let fileName of filesList) {
			let stateName = fileName.split('_').reverse()[0].replace('.csv','');
			let result = await readFileCSV(fileName);
			stateOuput[stateName] = result;
		}
		resolve(stateOuput);
	})
}

let missingEntries = {};
let finalStateJsonArray = [];

async function getCompaniesRecordByState(records){
	missingEntries = {};
	for(state in records) {
		console.log('Parsing.....', state);
		let element = records[state];
		let loopcounter = 0;
			for(urnId of element) {
					let finalJson = await getPageDetailsUsingUrnId( urnId );
					//let stateTableSchema = createTableByStateName( stateName );
					
					let inc = {};
					let mergedObject={};
					if(finalJson) {
						finalJson.forEach(function (tableData) {
							mergedObject = Object.assign(inc, tableData);
						});

						console.log(state + '  --  ' + loopcounter);

						if (inc) {
							finalStateJsonArray.push({State: state, Json: mergedObject});

							//console.log(finalStateJsonArray);
							// sequelize.sync()
							//     .then(() => stateTableSchema.create( inc ) );
						}
					}
					else {
						console.log('Not worked for : ', urnId);
						missingEntries[state] = missingEntries[state] || [];
						missingEntries[state].push(urnId);
					}
					//console.log('DB Entry Done');
					//DB Entry
					loopcounter++;
		}
	}

	checkAndRunMissingEntries();	
}

async function startScraping() {	
	let files = [];

	//read from the file & store it.
	let output = await getCSVRecordsFromFiles();
	getCompaniesRecordByState(output);
}

function checkAndRunMissingEntries(){
	if (Object.keys(missingEntries).length > 0){
		getCompaniesRecordByState(missingEntries);
	} else {
        finalStateJsonArray.forEach(( jsonData ) => {
            let stateTableSchema = createTableByStateName( jsonData.State );
            sequelize.sync()
                .then(() => stateTableSchema.create( jsonData.Json ) );
        });
	}
}


//make entry of final json in DB


async function crawling(file) {
	console.log('1');
	let output = {};
	if (file){
		let csvRecords = await getCSVRecords(file);
		output[csvRecords.stateName] = csvRecords;
		return output;
	}
}

function getPageDetailsUsingUrnId(urnId)
{
	console.log('URN-ID:', urnId);
		let url = 'https://www.zaubacorp.com/company/-/'+ urnId;
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

				switch ( tableName ){
					case 'company_details':
						data = $(this).next().html();
						tableDataArray.push( jsonArray( data, $ ) );
						break;
					case 'share_capital_&_number_of_employees':
						data = $(this).next().html();
						tableDataArray.push( jsonArray( data, $ ) );
						break;
					case '_listing_and_annual_compliance_details':
						data = $(this).next().html();
						tableDataArray.push( jsonArray( data, $ ) );
						break;
					case 'contact_details':
						data = $(this).next().html();
						tableDataArray.push( getJsonFromDiv( data, $ ) );
						break;
					case '_director_details':
						data = $(this).next().html();
						tableDataArray.push( getDirectorDetails( data, $ ) );
						break;
					default:
						//console.log( 'No matching table found.')
						break;
				}
			});
			return tableDataArray;
		})
			.catch(function (err) {
				//console.log(err);
			});
}

function getDirectorDetails( data, $ ){
		let object = {},
		directorNames = '';

			$( data ).children("tbody tr").map(function() {
				x = $(this).children();
				x.each(function( inc ) {
					if ( inc === 1 && $(this).text() !== undefined ){
						//console.log(  $(this).text().trim() );
						directorNames += $(this).text().trim() +',';
					}
					inc++;
				});
			});

		object['directors'] = directorNames.substring( 0, directorNames.length -1 );
		return object;
}

function jsonArray( data, $ ){
		let object = {};
		$( data ).children("tr").map(function() {
			let itArr = [];
			x = $(this).children();
			x.each(function( inc ) {
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
		let object = {};
		$( data ).map(function() {
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

function getCSVRecords(file){
		return new Promise(function(resolve, reject) {
			let arr = [];
			csv().fromStream(
				file // Request
			).on( 'csv' , (jsonObjRow) => {
				let value = {
					urnId 		: jsonObjRow[0],
					companyName : jsonObjRow[2],
					stateName	: jsonObjRow[8]
				};
				arr.push(value);
			})
				.on('end', function() {
					resolve(arr);
				});
		});
}

function createTableByStateName( stateName ){
    const stateTableName = sequelize.define(stateName, {
        cin 								: { type: Sequelize.STRING(1234) , unique: true },
        company_name						: Sequelize.STRING(1234),
        company_status						: Sequelize.STRING(1234),
        roc									: Sequelize.STRING(1234),
        registration_number					: Sequelize.STRING(1234),
        company_category					: Sequelize.STRING(1234),
        company_sub_category				: Sequelize.STRING(1234),
        class_of_company					: Sequelize.STRING(1234),
        date_of_incorporation				: Sequelize.STRING(1234),
        age_of_company						: Sequelize.STRING(1234),
        activity							: Sequelize.STRING(1234),
        number_of_members					: Sequelize.STRING(1234),
        authorised_capital					: Sequelize.STRING(1234),
        paid_up_capital						: Sequelize.STRING(1234),
        number_of_employees					: Sequelize.STRING(1234),
        listing_status						: Sequelize.STRING(1234),
        date_of_last_annual_general_meeting	: Sequelize.STRING(1234),
        date_of_latest_balance_sheet		: Sequelize.STRING(1234),
        _email_id							: Sequelize.STRING(1234),
        address								: Sequelize.STRING(1234),
        directors							: Sequelize.STRING(1234)
    });
    return stateTableName;
}

app.listen('8082')

console.log('Magic happens on port 8082');

exports = module.exports = app;