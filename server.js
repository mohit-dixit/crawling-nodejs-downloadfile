var express = require('express'),
fs = require('fs'),
request = require('request'),
cheerio = require('cheerio'),
app = express(),
csv = require('csvtojson'),
rp = require('request-promise'),
parse = require('csv-parse'),
constants = require('./constants.js')

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

async function startScraping() {	
	let files = [];

	//read from the file & store it.
	let output = await getCSVRecordsFromFiles();
	let finalStateJsonArray = [];
	for(state in output){
	console.log('Parsing.....', state);
	//if(state === 'Tripura')
	//{
		let element = output[state];
		let loopcounter = 0;
			for(urnId of element) {
					let finalJson = await getPageDetailsUsingUrnId( urnId );

					//let stateTableSchema = createTableByStateName( stateName );
					let inc = {};

					let mergedObject={};
					finalJson.forEach( function( tableData ){
						mergedObject = Object.assign( inc, tableData );
					});

					console.log(state + '  --  ' +loopcounter);

					if( inc ){
						finalStateJsonArray.push({State: state, Json : mergedObject});

						//console.log(finalStateJsonArray);
						// sequelize.sync()
						//     .then(() => stateTableSchema.create( inc ) );
					}

					//console.log('DB Entry Done');
					//DB Entry
					loopcounter++;
		}		
	//}
}

console.log('FINAL....     ', finalStateJsonArray )
//make entry of final json in DB

};


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

app.listen('8084')

console.log('Magic happens on port 8081');

exports = module.exports = app;