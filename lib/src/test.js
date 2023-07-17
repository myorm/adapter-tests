//@ts-check
import { MyORMContext } from "@myorm/myorm";
import clc from "cli-color";

const TABLE_NAMES = Object.freeze({
    Car: `Car`,
    Owner: `Owner`,
    Dealer: `Dealer`
});

const cout = {
    pass: (test) => console.log(`${clc.green(`[TEST ${test.name} PASSED]`)}: ${test.passMsg}.`),
    fail: (test) => console.log(`${clc.red(`[TEST ${test.name} FAILED]`)}: ${test.failMsg}.`),
    error: (test, err) => console.log(`${clc.red(`[TEST ${test.name} FAILED TO ERROR]`)}: ${test.failMsg}. (Error: ${err.message})`),
    start: (test) => console.log(`${clc.green(`[TEST ${test.name} START]`)}: ${test.msg}`),
    send: (msg) => console.log(clc.magenta(msg))
};



/**
 * @template TConnection
 * @param {import('@myorm/myorm').InitializeAdapterCallback<TConnection>} adapterInitializer
 * @param {TestContexts} contexts
 */
export async function testAdapter(adapterInitializer, contexts) {
    let test = {};
    try {
        for(let i = 0; i < tests.length; ++i) {
            test = tests[i];
            cout.start(test);
            if(await test.test(contexts)) {
                cout.pass(test);
            } else {
                cout.fail(test);
            }
        }
    } catch(err) {
        cout.error(test, err);
    }
}

/** @type {{ name: string, msg: string, test: (contexts: TestContexts) => Promise<boolean>, passMsg: string, failMsg: string}[]} */
const tests = [
    {
        name: `SCHEMA`,
        msg: `Validating schema matches expected schema for table, "${TABLE_NAMES.Car}".`,
        passMsg: `Schema for "${TABLE_NAMES.Car}"`,
        failMsg: ``,
        async test(contexts) {
            return isObjectEqual(contexts.cars.schema, SCHEMAS.cars);
        }
    },
    {
        name: `SCHEMA`,
        msg: `Validating schema matches expected schema for table, "${TABLE_NAMES.Dealer}".`,
        passMsg: ``,
        failMsg: ``,
        async test(contexts) {
            return isObjectEqual(contexts.dealers.schema, SCHEMAS.cars);
        }
    },
    {
        name: `SCHEMA`,
        msg: `Validating schema matches expected schema for table, "${TABLE_NAMES.Owner}".`,
        passMsg: ``,
        failMsg: ``,
        async test(contexts) {
            return isObjectEqual(contexts.owners.schema, SCHEMAS.cars);
        }
    },
    { 
        name: `QUERY`, 
        msg: `Select all from table, "${TABLE_NAMES.Car}", when table is empty.`,
        passMsg: ``,
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
        passMsg: ``,
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
        passMsg: ``,
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
        passMsg: ``,
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
        passMsg: ``,
        failMsg: ``,
        async test(contexts) {
            let newCars = [
                { Make: "Test1", Model: "Model8", Year: 8, Mileage: 8, MPGCity: 24.7 },
                { Make: "Test1", Model: "Model9", Year: 9, Mileage: 9, MPGHwy: 32.3 },
                { Make: "Test1", Model: "Model10", Year: 10, Mileage: 10,  }
            ];
            return false;
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
 * @typedef {object} Car
 * @prop {PRIMARY<IDENTITY<INT>>} Id
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
 * @prop {PRIMARY<IDENTITY<INT>>} Id
 * @prop {VARCHAR<20>} FirstName
 * @prop {VARCHAR<20>} LastName
 * @prop {NULLABLE<DATETIME>} DateOfBirth
 * 
 * @prop {xCarOwner[]=} Owners
 */

/**
 * @typedef {object} Dealer
 * @prop {PRIMARY<VARCHAR<36>>} Id
 * @prop {VARCHAR<20>} Name
 * 
 * @prop {xCarDealer[]=} Cars
 */

/**
 * @typedef {object} xCarOwner
 * @prop {PRIMARY<FOREIGN<INT, Car, "Id">>} CarId
 * @prop {PRIMARY<FOREIGN<INT, Owner, "Id">>} OwnerId
 * 
 * @prop {Car=} Car
 * @prop {Owner=} Owner
 */

/**
 * @typedef {object} xCarDealer
 * @prop {PRIMARY<FOREIGN<INT, Car, "Id">>} CarId
 * @prop {PRIMARY<FOREIGN<VARCHAR<36>, Dealer, "Id">>} DealerId
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

/**
 * @template {object} T
 * @typedef {{[K in keyof T as undefined extends T[K] ? never : K]-?: Exclude<T, undefined>[K]} 
 * & {[K in keyof T as T[K] extends IDENTITY<ScalarDataType>|NULLABLE<ScalarDataType> ? K : never]?: T[K]}} UndefinedAsOptional
 */

/** @typedef {UndefinedAsOptional<Car>} X */

/** @template T @typedef {{[K in keyof T]: import('@myorm/myorm').DescribedSchema}} ObjectSchema */

/** @type {{ cars: ObjectSchema<Car>, owners: ObjectSchema<Owner>, dealers: ObjectSchema<Dealer> }} */
const SCHEMAS = {
    cars: {
        Id: {
            table: "Car",
            field: "Id",
            alias: "",
            isPrimary: true,
            isIdentity: true,
            isVirtual: false,
            isNullable: false,
            isUnique: true,
            datatype: "int",
            defaultValue: () => undefined
        },
        Make: {
            table: "Car",
            field: "Make",
            alias: "",
            isPrimary: false,
            isIdentity: false,
            isVirtual: false,
            isNullable: false,
            isUnique: false,
            datatype: "int",
            defaultValue: () => undefined
        },
        Model: {
            table: "Car",
            field: "Model",
            alias: "",
            isPrimary: false,
            isIdentity: false,
            isVirtual: false,
            isNullable: false,
            isUnique: false,
            datatype: "int",
            defaultValue: () => undefined
        },
        Mileage: {
            table: "Car",
            field: "Mileage",
            alias: "",
            isPrimary: false,
            isIdentity: false,
            isVirtual: false,
            isNullable: false,
            isUnique: false,
            datatype: "int",
            defaultValue: () => undefined
        },
        Year: {
            table: "Car",
            field: "Year",
            alias: "",
            isPrimary: false,
            isIdentity: false,
            isVirtual: false,
            isNullable: false,
            isUnique: false,
            datatype: "int",
            defaultValue: () => undefined
        },
        MPGCity: {
            table: "Car",
            field: "MPGCity",
            alias: "",
            isPrimary: false,
            isIdentity: false,
            isVirtual: false,
            isNullable: true,
            isUnique: false,
            datatype: "float",
            defaultValue: () => undefined
        },
        MPGHwy: {
            table: "Car",
            field: "MPGHwy",
            alias: "",
            isPrimary: false,
            isIdentity: false,
            isVirtual: false,
            isNullable: true,
            isUnique: false,
            datatype: "float",
            defaultValue: () => undefined
        },
        DateCreated: {
            table: "Car",
            field: "DateCreated",
            alias: "",
            isPrimary: false,
            isIdentity: false,
            isVirtual: true,
            isNullable: false,
            isUnique: false,
            datatype: "string",
            defaultValue: () => new Date()
        },
        DateModified: {
            table: "Car",
            field: "DateCreated",
            alias: "",
            isPrimary: false,
            isIdentity: false,
            isVirtual: true,
            isNullable: false,
            isUnique: false,
            datatype: "string",
            defaultValue: () => new Date()
        }
    },
    owners: {
        Id: {
            table: "Owner",
            field: "Id",
            alias: "",
            isPrimary: false,
            isIdentity: false,
            isVirtual: false,
            isNullable: false,
            isUnique: false,
            datatype: "string",
            defaultValue: () => undefined
        },
        FirstName: {
            table: "Owner",
            field: "FirstName",
            alias: "",
            isPrimary: false,
            isIdentity: false,
            isVirtual: false,
            isNullable: false,
            isUnique: false,
            datatype: "string",
            defaultValue: () => undefined
        },
        LastName: {
            table: "Owner",
            field: "LastName",
            alias: "",
            isPrimary: false,
            isIdentity: false,
            isVirtual: false,
            isNullable: false,
            isUnique: false,
            datatype: "string",
            defaultValue: () => undefined
        },
        DateOfBirth: {
            table: "Owner",
            field: "DateOfBirth",
            alias: "",
            isPrimary: false,
            isIdentity: false,
            isVirtual: false,
            isNullable: true,
            isUnique: false,
            datatype: "date",
            defaultValue: () => undefined
        }
    },
    dealers: {
        Id: {
            table: "Dealer",
            field: "Id",
            alias: "",
            isPrimary: false,
            isIdentity: false,
            isVirtual: false,
            isNullable: false,
            isUnique: false,
            datatype: "string",
            defaultValue: function () {
                throw new Error("Function not implemented.");
            }
        },
        Name: {
            table: "Dealer",
            field: "Name",
            alias: "",
            isPrimary: false,
            isIdentity: false,
            isVirtual: false,
            isNullable: false,
            isUnique: false,
            datatype: "string",
            defaultValue: function () {
                throw new Error("Function not implemented.");
            }
        }
    }
};

// DESCRIBING DATA TYPES

/**
 * @typedef {ScalarStringDataType|ScalarDateDataType|ScalarNumericDataType} ScalarDataType
 */

/**
 * @typedef {PRIMARY<ScalarDataType>|FOREIGN<ScalarDataType, import("@myorm/myorm").SqlTable, keyof import("@myorm/myorm").SqlTable>|NULLABLE<ScalarDataType>|IDENTITY<ScalarDataType>|UNIQUE<ScalarDataType>|VIRTUAL<ScalarDataType>} Decorator
 */

/** @template {ScalarDataType|Decorator} T @typedef {T=} PRIMARY */
/** @template {ScalarDataType|Decorator} T @template {import("@myorm/myorm").SqlTable} TForeignObject @template {keyof import('@myorm/myorm').SqlTable} TForeignKey @typedef {T=} FOREIGN */
/** @template {ScalarDataType|Decorator} T @typedef {T=} NULLABLE */
/** @template {ScalarDataType|Decorator} T @typedef {T=} IDENTITY */
/** @template {ScalarDataType|Decorator} T @typedef {T} UNIQUE */
/** @template {ScalarDataType|Decorator} T @typedef {Readonly<T>=} VIRTUAL */
/** @template {ScalarDataType|Decorator} T @typedef {T} UNSIGNED */

// STRING DATA TYPES

/**
 * @typedef {TINYTEXT
 * |MEDIUMTEXT
 * |LONGTEXT
 * |TEXT<number>
 * |TINYBLOB
 * |MEDIUMBLOB
 * |LONGBLOB
 * |BLOB<number>
 * |CHAR<number>
 * |VARCHAR<number>
 * |BINARY<number>
 * |VARBINARY<number>
 * |ENUM<string|string[]>
 * |SET<string|string[]>} ScalarStringDataType
 */

/** @typedef {string} TINYTEXT */
/** @typedef {string} MEDIUMTEXT */
/** @typedef {string} LONGTEXT */

/**
 * @template {number} T
 * @typedef {string} TEXT
 */

/** @typedef {string} TINYBLOB */
/** @typedef {string} MEDIUMBLOB */
/** @typedef {string} LONGBLOB */

/**
 * @template {number} T
 * @typedef {string} BLOB
 */

/**
 * @template {string|string[]} T
 * @typedef {T extends Array ? T[number] : T} ENUM
 */

/**
 * @template {string|string[]} T
 * @typedef {T extends Array ? T[number] : T} SET
 */

/**
 * @template {number} [T=1]
 * @typedef {string} CHAR
 */

/**
 * @template {number} T
 * @typedef {string} VARCHAR
 */

/**
 * @template {number} T
 * @typedef {string} BINARY
 */

/**
 * @template {number} T
 * @typedef {string} VARBINARY
 */

// DATE DATA TYPES

/** @typedef {DATE|YEAR|DATETIME<string>|TIMESPAN<string>|TIME<string>} ScalarDateDataType */

/** @typedef {Date} DATE */
/** @typedef {Date} YEAR */
/** @template {string} [T=string] @typedef {Date} DATETIME */
/** @template {string} [T=string] @typedef {Date} TIMESPAN */
/** @template {string} [T=string] @typedef {Date} TIME */

// NUMERIC DATA TYPES

/** 
 * @typedef {BIT<IntRange0to63>
 * |TINYINT<IntRange0to255>
 * |BOOL
 * |BOOLEAN
 * |SMALLINT
 * |MEDIUMINT
 * |BIGINT
 * |INT
 * |FLOAT
 * |FLOAT4
 * |FLOAT8
 * |DOUBLE
 * |DOUBLE_PRECISION
 * |DECIMAL<IntRange0to65,IntRange0to30>
 * |DEC<IntRange0to65,IntRange0to30>} ScalarNumericDataType 
 * */

/** @template {IntRange0to63} [TSize=1] @typedef {TSize extends 1 ? boolean : number} BIT */
/** @template {IntRange0to255} [TSize=1] @typedef {number} TINYINT */
/** @typedef {boolean} BOOL */
/** @typedef {boolean} BOOLEAN */
/** @typedef {number} SMALLINT */
/** @typedef {number} MEDIUMINT */
/** @typedef {bigint} BIGINT */
/** @typedef {number} INT */
/** @typedef {number} FLOAT */
/** @typedef {number} FLOAT4 */
/** @typedef {number} FLOAT8 */
/** @typedef {number} DOUBLE */
/** @typedef {number} DOUBLE_PRECISION */
/** @template {IntRange0to65} [TSize=10] @template {IntRange0to30} [TDecimalSize=0] @typedef {number} DECIMAL */
/** @template {IntRange0to65} [TSize=10] @template {IntRange0to30} [TDecimalSize=0] @typedef {number} DEC */

/** @typedef {0|1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30} IntRange0to30 */
/** @typedef {0|1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42|43|44|45|46|47|48|49|50|51|52|53|54|55|56|57|58|59|60|61|62|63} IntRange0to63 */
/** @typedef {0|1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42|43|44|45|46|47|48|49|50|51|52|53|54|55|56|57|58|59|60|61|62|63|64|65|66|67|68|69|70|71|72|73|74|75|76|77|78|79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115|116|117|118|119|120|121|122|123|124|125|126|127|128|129|130|131|132|133|134|135|136|137|138|139|140|141|142|143|144|145|146|147|148|149|150|151|152|153|154|155|156|157|158|159|160|161|162|163|164|165|166|167|168|169|170|171|172|173|174|175|176|177|178|179|180|181|182|183|184|185|186|187|188|189|190|191|192|193|194|195|196|197|198|199|200|201|202|203|204|205|206|207|208|209|210|211|212|213|214|215|216|217|218|219|220|221|222|223|224|225|226|227|228|229|230|231|232|233|234|235|236|237|238|239|240|241|242|243|244|245|246|247|248|249|250|251|252|253|254|255} IntRange0to255 */
/** @typedef {IntRange0to63|64|65} IntRange0to65 */

/**
 * @template {string} S
 * @template {0[]} [Acc=[]]
 * @typedef {S extends `${string}${infer $Rest}` ? LengthOfString<$Rest, [...Acc, 0]> : Acc["length"]} LengthOfString
 */

/**
 * @template {string} S
 * @template {number} TLength
 * @typedef {LengthOfString<S> extends TLength ? true : false} IsStringOfLength
 */