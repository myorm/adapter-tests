//@ts-check
import { MyORMContext } from "@myorm/myorm";
import clc from "cli-color";

const DATABASE_NAME = `MyORM_Adapter_cout_Database_For_Vehicles`;
const TABLE_NAMES = Object.freeze({
    Car: `MyORM_Car`,
    Owner: `MyORM_Owner`,
    Dealer: `MyORM_Dealer`
});
const SCHEMAS = Object.freeze({
    cars: {
        
    }
});

const cout = {
    normal: (msg) => console.log(msg),
    pass: (msg) => console.log(`${clc.green("[PASS]")}: ${msg}`),
    fail: (msg) => console.log(`${clc.red("[FAIL]")}: ${msg}`),
    warn: (msg) => console.log(`${clc.yellow("[WARNING]")}: ${msg}`),
    start: (name, msg) => console.log(`${clc.blue(`Starting cout for [${name}]`)}: ${msg}`),
    send: (msg) => console.log(clc.magenta(msg))
};



/**
 * @template TConnection
 * @param {import('@myorm/myorm').InitializeAdapterCallback<TConnection>} adapter
 * @param {DatabaseParams<TConnection>} database
 * @param {boolean=} risksAcknowledged
 */
export async function coutAdapter(adapter, { createDatabase, dropDatabase, createTable, dropTable, createConnection }, risksAcknowledged=false) {
    if(!risksAcknowledged) {
        cout.warn(`The MyORM custom adapter couts require temporarily adding data to the connection you provided to work with. This includes the following:`);
        cout.normal(`  - Creating a new database "${DATABASE_NAME}".`);
        cout.normal(`  - Creating a new table, "${TABLE_NAMES.Car}", within the database, "${DATABASE_NAME}".`);
        cout.normal(`  - Creating a new table, "${TABLE_NAMES.Dealer}", within the database, "${DATABASE_NAME}".`);
        cout.normal(`  - Creating a new table, "${TABLE_NAMES.Owner}", within the database, "${DATABASE_NAME}".`);
        cout.normal(`  - Dropping the table, "${TABLE_NAMES.Car}", from the database, "${DATABASE_NAME}".`);
        cout.normal(`  - Dropping the table, "${TABLE_NAMES.Dealer}", from the database, "${DATABASE_NAME}".`);
        cout.normal(`  - Dropping the table, "${TABLE_NAMES.Owner}", from the database, "${DATABASE_NAME}".`);
        cout.normal(`  - Dropping the database, "${DATABASE_NAME}", from the database.`);
        throw new Error(`Please confirm you have acknowledged the risks of this couting suite by passing "true" into the third parameter.`);
    } else {
        try {
            cout.send(`Initializing cout data...`);
            cout.send(`Creating database "${DATABASE_NAME}".`);
            await createDatabase(DATABASE_NAME);
            cout.send(`Creating table, "${TABLE_NAMES.Car}", in database, "${DATABASE_NAME}".`);
            await createTable(TABLE_NAMES.Car);
            cout.send(`Creating table, "${TABLE_NAMES.Dealer}", in database, "${DATABASE_NAME}".`);
            await createTable(TABLE_NAMES.Dealer);
            cout.send(`Creating table, "${TABLE_NAMES.Owner}", in database, "${DATABASE_NAME}".`);
            await createTable(TABLE_NAMES.Owner);
    
            const cnn = await createConnection(DATABASE_NAME);
            const adapterConnection = adapter(cnn);
            const contexts = {
                cars: new MyORMContext(adapterConnection, "Car"),
                owners: new MyORMContext(adapterConnection, "Owner"),
                dealers: new MyORMContext(adapterConnection, "Dealer")
            };
            
            contexts.cars.schema
    
            cout.start("QUERY");
        } catch(err) {
    
        } finally {
            cout.send(`Deleting database, "${DATABASE_NAME}".`);
            await dropDatabase(DATABASE_NAME);
        }
    }
}

/** @type {{ name: string, msg: string, test: (contexts: TestContexts) => Promise<boolean>, failMsg: string}[]} */
const tests = [
    {
        name: `SCHEMA`,
        msg: `Validating schema matches expected schema for table, "${TABLE_NAMES.Car}".`,
        failMsg: ``,
        async test(contexts) {
            return isObjectEqual(contexts.cars.schema, SCHEMAS.cars);
        }
    },
    { 
        name: `QUERY`, 
        msg: `Select all from table, "${TABLE_NAMES.Car}", when table is empty.`,
        failMsg: `Expected 0 rows in the table.`,
        async test(contexts) {
            let results = await contexts.cars.select();
            return results.length <= 0;
        }
    },
    {
        name: 'INSERT',
        msg: `Insert single record into table, "${TABLE_NAMES.Car}".`,
        failMsg: `Expected returned object from insert to be equal to the inserted object, along with "Id" to be present.`,
        async test(contexts) {
            let newCar = {
                Make: "Test1",
                Model: "Model1",
                Year: 1,
                Mileage: 1
            };
            const [test1Model1] = await contexts.cars.insert(newCar);

            return isObjectEqual(newCar, test1Model1) && "Id" in test1Model1;
        }
    },
    {
        name: 'INSERT',
        msg: `Insert single record into table, "${TABLE_NAMES.Car}", inside of an array.`,
        failMsg: `Expected returned object from insert to be equal to the inserted object, along with "Id" to be present.`,
        async test(contexts) {
            let newCar = {
                Make: "Test1",
                Model: "Model2",
                Year: 2,
                Mileage: 2
            };
            const [test1Model2] = await contexts.cars.insert([newCar]);

            return isObjectEqual(newCar, test1Model2) && "Id" in test1Model2;
        }
    },
    {
        name: "INSERT",
        msg: `Insert multiple records into table, "${TABLE_NAMES.Car}. (only required properties on all records)"`,
        failMsg: `Expected returned array of objects from insert to be equal to the inserted objects.`,
        async test(contexts) {
            let newCars = [
                { Make: "Test1", Model: "Model3", Year: 3, Mileage: 3 },
                { Make: "Test1", Model: "Model4", Year: 4, Mileage: 4 },
                { Make: "Test1", Model: "Model5", Year: 5, Mileage: 5 },
                { Make: "Test1", Model: "Model6", Year: 6, Mileage: 6 },
                { Make: "Test1", Model: "Model7", Year: 7, Mileage: 7 }
            ];
            const results = await contexts.cars.insert(newCars);

            return results.length == newCars.length && results.filter((c,n) => isObjectEqual(newCars[n], c)).length <= 0;
        }
    },
    {
        name: "INSERT",
        msg: `Insert multiple records into table, "${TABLE_NAMES.Car}. (properties mixed across all records)"`,
        failMsg: ``,
        async test(contexts) {
            let newCars = [
                { Make: "Test1", Model: "Model8", Year: 8, Mileage: 8, MPGCity: 24.7 },
                { Make: "Test1", Model: "Model9", Year: 9, Mileage: 9, MPGHwy: 32.3 },
                { Make: "Test1", Model: "Model10", Year: 10, Mileage: 10,  }
            ];
        }
    }
];

/**
 * Compares the properties from `obj1` to the properties in `obj2`.
 * @param {any} obj1
 * Object to check from (keys are looped from this object)
 * @param {any} obj2
 * Object to check against
 * @param {string[]=} ignoreKeys
 * Additional keys to ignore. (default: [])
 * @returns {boolean}
 * True if the objects equal, false otherwise.
 */
function isObjectEqual(obj1, obj2, ignoreKeys=[]) {
    for(const key of Object.keys(obj1)) {
        if(ignoreKeys.includes(key)) continue;
        if(!(key in obj2)) return false;
        if(obj1[key] !== obj2[key]) return false;
    }
    return true;
}


/**
 * @template T
 * @typedef {Promise<T>|T} MaybePromise
 */

/**
 * @template TConnection
 * @typedef {object} DatabaseParams
 * @prop {(dbName: string) => MaybePromise<void>} createDatabase
 * @prop {(dbName: string) => MaybePromise<void>} dropDatabase
 * @prop {(tableName: string) => MaybePromise<void>} createTable
 * @prop {(tableName: string) => MaybePromise<void>} dropTable
 * @prop {(database: string) => MaybePromise<TConnection>} createConnection
 */

/**
 * @typedef {object} Car
 * @prop {AUTO_INCREMENT<INT>} Id
 * @prop {VARCHAR<20>} Make
 * @prop {VARCHAR<20>} Model
 * @prop {INT} Year
 * @prop {INT} Mileage
 * @prop {NULLABLE<INT>} MPGCity
 * @prop {NULLABLE<INT>} MPGHwy
 * @prop {NULLABLE<DATETIME>} DateCreated
 * @prop {NULLABLE<DATETIME>} DateModified
 * 
 * @prop {xCarOwner[]=} Owners
 * @prop {xCarDealer=} Dealer
 */

/**
 * @typedef {object} Owner
 * @prop {INT} Id
 * @prop {VARCHAR<20>} FirstName
 * @prop {VARCHAR<20>} LastName
 * @prop {NULLABLE<DATETIME>} DateOfBirth
 * 
 * @prop {xCarOwner[]=} Owners
 */

/**
 * @typedef {object} Dealer
 * @prop {VARCHAR<32>} Id
 * @prop {VARCHAR<20>} Name
 * 
 * @prop {xCarDealer[]=} Cars
 */

/**
 * @typedef {object} xCarOwner
 * @prop {INT} CarId
 * @prop {INT} OwnerId
 * 
 * @prop {Car=} Car
 * @prop {Owner=} Owner
 */

/**
 * @typedef {object} xCarDealer
 * @prop {INT} CarId
 * @prop {VARCHAR<36>} DealerId
 * 
 * @prop {Car=} Car
 * @prop {Dealer=} Dealer
 */

/**
 * @typedef {object} TestContexts
 * @prop {MyORMContext<UndefinedAsOptional<Car>>} cars
 * @prop {MyORMContext<UndefinedAsOptional<Owner>>} owners
 * @prop {MyORMContext<UndefinedAsOptional<Dealer>>} dealers
 */

/** @typedef {number} INT */
/** @template T @typedef {string} VARCHAR */
/** @typedef {Date} DATETIME */
/** @template T @typedef {T=} NULLABLE */
/** @template T @typedef {T=} AUTO_INCREMENT  */

/**
 * @template {object} T
 * @typedef {{[K in keyof T as undefined extends T[K] ? never : K]-?: Exclude<T, undefined>[K]} 
 * & {[K in keyof T as undefined extends T[K] ? K : never]?: T[K]}} UndefinedAsOptional
 */

/** @typedef {UndefinedAsOptional<Car>} X */