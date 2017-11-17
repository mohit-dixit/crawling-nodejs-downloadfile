let Sequelize 	= require('sequelize'),
    constants 	= require('./constants.js');

let sequelize;

module.exports = {
    init: initialize,
    insert: insertDataInDB
};

//===============================================
const initialize = () => {
    sequelize = new Sequelize(constants.DB.NAME, constants.DB.USERNAME, constants.DB.PASSWORD, {
        host: constants.DB.CONFIG.host,
        dialect: constants.DB.CONFIG.dialect,
        operatorsAliases: false,
        pool: {
            max: constants.DB.CONFIG.POOL_MAX,
            min: constants.DB.CONFIG.POOL_MIN,
            acquire: constants.DB.CONFIG.POOL_ACQUIRE,
            idle: constants.DB.CONFIG.POOL_IDLE
        },
        dialectOptions: {
            requestTimeout: constants.DB.CONFIG.TIME_OUT
        },
    });
};

const insertDataInDB = async (json, stateName) => {
    // Inserting data in database
    for(let data of json){
        let stateTableSchema = createTableByStateName( stateName );
        let response = await insertTableDataInDB( stateTableSchema, data );
    }
};

const insertTableDataInDB = async (stateTableSchema, jsonArray) => {
    return sequelize.sync()
        .then(() =>
            stateTableSchema.create( jsonArray )
        ).catch(err => {
            return err;
        });
};

const createTableByStateName = (stateName) => {
    // Defining the schema of table
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
};
