module.exports = exports = {
    LINKS: {
        COMPANY_DATA_URL:'https://www.zaubacorp.com/company/-/'
    },
    FILES_BASE_PATH: './downloaded_files/',
    JSON_FILES_BASE_PATH: './json_files/',
    DB: {
        NAME: 'webcrawler',
        USERNAME: 'root',
        PASSWORD: 'admin',
        CONFIG: {
            host: 'localhost',
            dialect: 'mysql',
            POOL_MIN: 0,
            POOL_MAX: 1,
            POOL_ACQUIRE: 20000,
            POOL_IDLE: 20000,
            TIME_OUT: 5000
        }
    },
    KEYWORDS: {
            COMPANY_DETAILS: 'company_details',
            SHARE_CAPITAL: 'share_capital_&_number_of_employees',
            ANNUAL_COMPLIANCE_DETAILS: '_listing_and_annual_compliance_details',
            CONTACT_DETAILS: 'contact_details',
            DIRECTOR_DETAILS: '_director_details'
    },
    PORT: 8083
};