//@ts-check
import { MyORMContext } from "@myorm/myorm";
import { v4 } from 'uuid';
import clc from "cli-color";

var testNumber = 0;
/**
 * @type {{ cars: UndefinedAsOptional<Car>[], accidents: UndefinedAsOptional<Accident>[], owners: UndefinedAsOptional<Owner>[] }}
 */
var allInserted = {
    cars: [],
    accidents: [],
    owners: []
};

/** @typedef {{ num: number, description: string, fail: (msg: string) => void; pass: (msg?: string) => void; }} TestDetails */

/**
 * 
 * @param {string} description 
 * @returns {TestDetails}
 */
function printTest(description) {
    const testNum = ++testNumber;
    console.log(clc.bgMagenta(`[TEST ${testNum} START]: ${description}`));
    return {
        num: testNum,
        description,
        fail: (reason) => {
            console.log(clc.red(`[TEST ${testNum} FAILED]: ${reason}`));
            throw Error(`[TEST ${testNum} FAILED] ${reason}`);
        },
        pass: (msg="") => {
            console.log(clc.green(`[TEST ${testNum} PASSED] ${msg}`));
        }
    }
}

var __options = { verbose: false };
var i = 0;
/**
 * @param {TestContexts} contexts
 * @param {{verbose: boolean}} options
 */
export async function testAdapter(contexts, options={ verbose: false }) {
    __options = { ...__options, options };
    try {
        // Test 1
        const test = printTest(`Testing MyORMContext<Accident>.count()`);
        i = await contexts.accidents.count();

        const { carDefaultTest, accidentDefaultTest } = await testDefaults(contexts);
        
        await testInserts(contexts, carDefaultTest, accidentDefaultTest);
        await testUpdates(contexts);
        await testSelects(contexts);
        await testDeletes(contexts);
    } catch(err) {
    }
}

/**
 * 
 * @param {TestContexts} contexts
 * @returns {Promise<{ carDefaultTest: TestDetails, accidentDefaultTest: TestDetails }>}
 */
async function testDefaults(contexts) {
    let test = printTest(`MyORMContext<Car>.default(async m => m.Id = (await import('uuid')).v4())`);
    try {
        contexts.cars.default(m => m.Id = v4());
        test.pass();
        const carDefaultTest = test;

        test = printTest(`MyORMContext<Accident>.default(async m => m.Id = ++i)`);
        contexts.accidents.default(m => m.Id = i++);
        test.pass();
        const accidentDefaultTest = test;

        return { carDefaultTest, accidentDefaultTest };
    } catch(err) {
        test.fail(`An error occurred when running test described as: "${test.description}"`);
        throw err;
    }
}

/**
 * 
 * @param {TestContexts} contexts
 * @param {TestDetails} carDefaultTest
 * @param {TestDetails} accidentDefaultTest
 */
async function testInserts(contexts, carDefaultTest, accidentDefaultTest) {
    try {
        const newCar = randomCar(false, { Make: "Ford", Model: "Focus", Year: 2008, Mileage: 74999 });
        allInserted.cars.push(newCar);
        
        let test = printTest(`MyORMContext<Car>.insert(${jsonify(newCar)})`);
        const [car] = await contexts.cars.insert(newCar);

        if(car.Id?.length === 36) {
            carDefaultTest.pass(`Id matched.`);
        } else {
            accidentDefaultTest.fail(`Default Id did not match. (${car.Id} !== ${i})`);
        }
        
        if (isObjectEqual(newCar, car)) {
            test.pass(`Cars match.`);
        } else {
            test.fail(`Car that was inserted does not match the Accident that was returned.`);
        }

        const newAccident = randomAccident(car.Id);
        allInserted.accidents.push(newAccident);

        test = printTest(`MyORMContext<Accident>.insert(${jsonify(newAccident)})`);
        const [accident] = await contexts.accidents.insert(newAccident);

        if(accident.Id === i) {
            accidentDefaultTest.pass(`Id matched.`);
        } else {
            accidentDefaultTest.fail(`Default Id did not match. (${accident.Id} !== ${i})`);
        }

        if (isObjectEqual(newAccident, accident)) {
            test.pass(`Accidents match.`);
        } else {
            test.fail(`Accident that was inserted does not match the Accident that was returned.`);
        }

        const newAccidents = [
            randomAccident(car.Id),
            randomAccident(car.Id),
            randomAccident(car.Id),
        ];

        allInserted.accidents = allInserted.accidents.concat(newAccidents);

        test = printTest(`MyORMContext<Accident>.insert(${jsonify(newAccidents)})`);
        const accidents = await contexts.accidents.insert(newAccidents);

        const filtered = newAccidents.map((acc, n) => !isObjectEqual(acc, accidents[n]));
        if(filtered.length > 0) {
            test.fail(`One or more of the inserted accidents do not match the respective accident that was returned.`);
        }
    } catch(err) {
        throw err;
    }
}

/**
 * 
 * @param {TestContexts} contexts 
 */
async function testUpdates(contexts) {
    const newOwner = randomOwner();
    const [owner] = await contexts.owners.insert(newOwner);
    allInserted.owners.push(newOwner);

    let test = printTest(`MyORMContext<Owner>.update(${jsonify(newOwner)})`);

    owner.DateOwnershipStarted = randomDate('01/01/2000', '01/01/2015');
    let numRowsAffected = await contexts.owners.update(owner);

    if(numRowsAffected === 1) {
        test.pass(`Number of rows affected equaled 1.`);
    } else {
        test.fail(`Number of rows affected does not equal 1. (actual: ${numRowsAffected})`);
    }

    const newOwners = [
        randomOwner(),
        randomOwner(),
        randomOwner(),
    ];
    const owners = await contexts.owners.insert(newOwners);
    allInserted.owners = allInserted.owners.concat(newOwners);

    test = printTest(`MyORMContext<Owner>.update(${jsonify(newOwners)})`);

    owners.forEach(owner => {
        owner.DateOwnershipStarted = randomDate('01/01/2000', '01/01/2015');
    })
    numRowsAffected = await contexts.owners.update(owners);

    if (numRowsAffected === 3) {
        test.pass(`Number of rows affected equaled 3.`);
    } else {
        test.fail(`Number of rows affected does not equal 1. (actual: ${numRowsAffected})`);
    }

    test = printTest(`MyORMContext<Owner>.where(m => m.Id.equals(${owner.Id})).update(m => { m.DateOwnershipEnded = randomDate(); })`);
    numRowsAffected = await contexts.owners.where(m => m.Id.equals(owner.Id)).update(m => {
        m.DateOwnershipEnded = randomDate(
            `${owner.DateOwnershipStarted.getFullYear()}/${owner.DateOwnershipStarted.getDay()}/${owner.DateOwnershipStarted.getFullYear()}`,
        );
    });

    if (numRowsAffected === 1) {
        test.pass(`Number of rows affected equaled 1.`);
    } else {
        test.fail(`Number of rows affected does not equal 1. (actual: ${numRowsAffected})`);
    }

    const newCars = [
        randomCar(true, { Make: "Ford", Model: "Fusion"}),
        randomCar(true, { Make: "Toyota", Model: "Tundra "}),
        randomCar(true, { Make: "Dodge", Model: "Durango" }),
    ];
    const cars = await contexts.cars.insert(newCars);
    allInserted.cars = allInserted.cars.concat(newCars);

    test = printTest(`MyORMContext<Car>.where(m => m.Id.in([${cars.map(c => c.Id).join(',')}])).update(m => { m.IsTitleSalvaged = true; })`);

    numRowsAffected = await contexts.cars.where(m => m.Id.in(cars.map(c => c.Id))).update(m => {
        m.IsTitleSalvaged = true;
    });

    if (numRowsAffected === 3) {
        test.pass(`Number of rows affected equaled 3.`);
    } else {
        test.fail(`Number of rows affected does not equal 1. (actual: ${numRowsAffected})`);
    }
}

/**
 * 
 * @param {TestContexts} contexts 
 */
async function testDeletes(contexts) {

}

/**
 * @param {TestContexts} contexts
 */
async function testSelects(contexts) {
    let test = printTest(`MyORMContext<Car>.select()`);
    let cars = await contexts.cars.select();

    if(cars.length === allInserted.cars.length) {
        test.pass(`Retrieved all cars in the database.`);
    } else {
        test.fail(`One or more cars are missing from the database. (make sure you did not pass a stateful context.)`);
    }

    test = printTest(`MyORMContext<Accident>.select(m => m.Id)`);
    const accidents = await contexts.accidents.select();

    if(accidents.length === allInserted.accidents.length) {
        test.pass(`Retrieved all accidents in the database.`);
    } else {
        test.fail(`One or more accidents are missing from the database. (make sure you did not pass a stateful context.)`);
    }

    if (Object.keys(accidents[0]).filter(k => !["Id"].includes(k)).length <= 0) {
        test.pass(`The columns, "Id", "FirstName", and "LastName" are the only keys present.`);
    } else {
        test.fail(`The keys in the records contain keys that were not selected.`);
    }

    test = printTest(`MyORMContext<Owner>.select(m => [m.Id, m.FirstName, m.LastName])`);
    const owners = await contexts.owners.select();

    if(owners.length === allInserted.owners.length) {
        test.pass(`Retrieved all owners in the database.`);
    } else {
        test.fail(`One or more owners are missing from the database. (make sure you did not pass a stateful context.)`);
    }

    if(Object.keys(owners[0]).filter(k => !["Id", "FirstName", "LastName"].includes(k)).length <= 0) {
        test.pass(`The columns, "Id", "FirstName", and "LastName" are the only keys present.`);
    } else {
        test.fail(`The keys in the records contain keys that were not selected.`);
    }
    
    test = printTest(`MyORMContext<Car>.where(m => m.Make.equals("Ford")).select()`);
    const fordCars = await contexts.cars.where(m => m.Make.equals("Ford")).select();

    if(fordCars.length === 2) {
        test.pass(`Retrieved all cars in the database that are of "Make" = "Ford".`);
    } else {
        test.fail(`The query returning cars in the database that are of "Make" = "Ford" does not match the number of rows that were updated. (actual: ${fordCars.length}, expected: 2)`)
    }

    test = printTest(`MyORMContext<Car>.where(m => m.Make.equals("Ford").and(m => m.Model.equals("Focus"))).select()`);
    console.log(`${clc.bgCyan(`All rows with a "Year" between 2000 and 2005 and "Model" equal to "Ford" will be updated to have their "Model" to "Focus".`)}`)
    const fordFocuses = await contexts.cars.where(m => m.Make.equals("Ford").and(m => m.Model.equals("Focus"))).select();

    if (fordFocuses.length === 1) {
        test.pass(`Retrieved all cars in the database that are of "Make" = "Ford" and "Model" = "Focus".`);
    } else {
        test.fail(`The query returning cars in the database that are of "Make" = "Ford" and "Model" = "Focus" does not match the number of rows that were updated. (actual: ${fordCars.length}, expected: 1)`)
    }

    test = printTest(`MyORMContext<Car>.where(m => m.Make.equals("Dodge")
        .and(m => m.Model.equals("Durango"))
        .or(m => m.Year.between(2005, 2015)
            .and(m => m.Mileage.lessThan(75000))
        )
    ).select()`);
    let filteredCars = await contexts.cars.where(m => m.Make.equals("Dodge")
        .and(m => m.Model.equals("Durango"))
        .or(m => m.Year.between(2005, 2015)
            .and(m => m.Mileage.lessThan(75000))
        )
    ).select();

    if (filteredCars.length === 2) {
        test.pass(`Retrieved all cars in the database that are of "Make" = "Dodge" and "Model" = "Durango" OR their Year is between "2005" and "2015" and "Mileage" < "75000".`);
    } else {
        test.fail(`The query returning cars in the database that are of "Make" = "Dodge" and "Model" = "Durango" OR their Year is between "2005" and "2015" and "Mileage" < "75000" does not match the number of rows that were updated. (actual: ${fordCars.length}, expected: 2)`)
    }

    test = printTest(`MyORMContext<Car>.sortBy(m => m.Year).select()`);
    cars = await contexts.cars.sortBy(m => m.Year).select();

    let lastYear = 0;
    for(const car of cars) {
        if(car.Year < lastYear) {
            test.fail(`One or more vehicles did return in the correct ascending order.`);
        }
        lastYear = car.Year;
    }
    test.pass(`All vehicles were correctly sorted in ascending order.`);

    test = printTest(`MyORMContext<Car>.sortBy(m => m.Year.desc()).select()`);
    cars = await contexts.cars.sortBy(m => m.Year.desc()).select();

    lastYear = 9999;
    for (const car of cars) {
        if (car.Year > lastYear) {
            test.fail(`One or more vehicles did return in the correct descending  order.`);
        }
        lastYear = car.Year;
    }
    test.pass(`All vehicles were correctly sorted in descending order.`);

    test = printTest(`MyORMContext<Car>.sortBy(m => [m.Make, m.Year]).select()`);
    cars = await contexts.cars.sortBy(m => [m.Make, m.Year]).select();

    let lastMake = "ZZZZZZ";
    lastYear = 0;
    for (const car of cars) {
        const compare = car.Make.localeCompare(lastMake);
        if (compare > 0 || compare === 0 && car.Year < lastYear) {
            test.fail(`One or more vehicles did return in the correct ascending order.`);
        }
        lastMake = car.Make;
        lastYear = car.Year;
    }
    test.pass(`All vehicles were correctly sorted in ascending order.`);

    test = printTest(`MyORMContext<Car>.groupBy(m => m.Make).select()`);
    const carsGroupedByMake = await contexts.cars.groupBy(m => m.Make).select();

    if(carsGroupedByMake.length !== 3 || carsGroupedByMake.filter(g => ["Ford", "Dodge", "Toyota"].includes(g.Make))) {
        test.fail(`Groups returned does not match expected groups. (There should be 3 groups-- "Ford", "Dodge", and "Toyota")`)
    }
    test.pass(`Groups returned are all of "Make": "Ford", "Dodge", or "Toyota"`);

    if (Object.keys(carsGroupedByMake[0]).filter(k => !["Make"].includes(k)).length <= 0) {
        test.fail(`Groups returned have keys that weren't expected (actual: [${Object.keys(carsGroupedByMake[0])}], expected: ["Make"])`);
    }
    test.pass(`Groups returned all have only the keys requested within the .groupBy function.`);

    test = printTest(`MyORMContext<Car>.groupBy((m, { avg }) => [m.Make, avg(m.Mileage)]).select()`);
    const carsGroupedByMakeWithAvgMileage = await contexts.cars.groupBy((m, {avg}) => [m.Make, avg(m.Mileage)]).select();
    if (carsGroupedByMake.length !== 3 || carsGroupedByMake.filter(g => ["Ford", "Dodge", "Toyota"].includes(g.Make))) {
        test.fail(`Groups returned does not match expected groups. (There should be 3 groups-- "Ford", "Dodge", and "Toyota")`)
    }
    test.pass(`Groups returned are all of "Make": "Ford", "Dodge", or "Toyota"`);

    if (Object.keys(carsGroupedByMake[0]).filter(k => !["Make", "$avg_Mileage"].includes(k)).length <= 0) {
        test.fail(`Groups returned have keys that weren't expected (actual: [${Object.keys(carsGroupedByMake[0])}], expected: ["Make", "$avg_Mileage"])`);
    }

    let expectedSum = allInserted.cars.filter(c => c.Make === "Ford").map(c => c.Mileage).reduce((a, b) => a + b, 0);
    let expectedAvg = allInserted.cars.filter(c => c.Make === "Ford").map(c => c.Mileage).reduce((a, b) => a + b, 0) / allInserted.cars.filter(c => c.Make === "Ford").length;
    let actualAvg = carsGroupedByMakeWithAvgMileage.filter(c => c.Make === "Ford")[0].$avg_Mileage;
    if(carsGroupedByMakeWithAvgMileage.filter(c => c.Make === "Ford")[0] === undefined || expectedAvg !== actualAvg) {
        test.fail(`The average aggregate for the group, "Ford" does not equal the actual average aggregate. (expected: ${expectedAvg}, actual: ${actualAvg})`)
    }
    test.pass(`Groups returned have the correct aggregate value.`);

    test = printTest(`MyORMContext<Car>.groupBy((m, { avg }) => [m.Make, avg(m.Mileage), sum(m.Mileage)]).select()`);
    const carsGroupedByMakeWithAvgMileageAndSumMileage = await contexts.cars.groupBy((m, { avg, sum }) => [m.Make, avg(m.Mileage), sum(m.Mileage)]).select();
    if (carsGroupedByMake.length !== 3 || carsGroupedByMake.filter(g => ["Ford", "Dodge", "Toyota"].includes(g.Make))) {
        test.fail(`Groups returned does not match expected groups. (There should be 3 groups-- "Ford", "Dodge", and "Toyota")`)
    }
    test.pass(`Groups returned are all of "Make": "Ford", "Dodge", or "Toyota"`);

    if (Object.keys(carsGroupedByMake[0]).filter(k => !["Make", "$avg_Mileage"].includes(k)).length <= 0) {
        test.fail(`Groups returned have keys that weren't expected (actual: [${Object.keys(carsGroupedByMake[0])}], expected: ["Make", "$avg_Mileage"])`);
    }

    actualAvg = carsGroupedByMakeWithAvgMileageAndSumMileage.filter(c => c.Make === "Ford")[0].$avg_Mileage;
    let actualSum = carsGroupedByMakeWithAvgMileageAndSumMileage.filter(c => c.Make === "Ford")[0].$sum_Mileage;
    if (carsGroupedByMakeWithAvgMileage.filter(c => c.Make === "Ford")[0] === undefined || expectedAvg !== actualAvg || expectedSum !== actualSum) {
        test.fail(`One or more of the aggregates for the group, "Ford" does not equal the actual average aggregate. (AVG: expected: ${expectedAvg}, actual: ${actualAvg}, SUM: expected: ${expectedSum}, actual: ${actualSum})`)
    }
    test.pass(`Groups returned have the correct aggregate value.`);

    test = printTest(`MyORMContext<Car>.take(1).select()`);
    const oneCar = await contexts.cars.take(1).select();
    if(oneCar.length !== 1) {
        test.fail(`Number of cars returned does not equal 1. (actual: ${oneCar.length})`);
    }
    test.pass(`Number of cars returned equals 1.`);

    test = printTest(`MyORMContext<Car>.skip(1).take(1).select()`);
    const oneCarSkipped = await contexts.cars.skip(1).take(1).select();
    if (oneCar.length !== 1) {
        test.fail(`Number of cars returned does not equal 1. (actual: ${oneCar.length})`);
    }
    test.pass(`Number of cars returned equals 1.`);

    if (isObjectEqual(oneCar[0], oneCarSkipped[0])) {
        test.fail(`Car wasn't skipped.`);
    }
    test.pass(`First car was successfully skipped.`);
}

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
function isObjectEqual(obj1, obj2, ignoreKeys = []) {
    for (const key of Object.keys(obj1)) {
        if (ignoreKeys.includes(key)) continue;
        if (!(key in obj2)) return false;
        if (obj1[key] !== obj2[key]) return false;
    }
    return true;
}

/**
 * 
 * @param {number} length 
 * @returns {string}
 */
function randomString(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
        counter += 1;
    }
    return result;
}

/**
 * 
 * @param {number} min 
 * @param {number} max 
 * @returns {number}
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min) + 1 + min)
}

/**
 * 
 * @param {number} min 
 * @param {number} max 
 * @returns {number}
 */
function randomFloat(min, max) {
    return parseFloat((Math.random() * (max - min) + 1 + min).toFixed(2))
}

/**
 * 
 * @param {string=} date1
 * @param {string=} date2
 * @returns {Date}
 */
function randomDate(date1 = '01/01/2000', date2 = '01/01/2023') {
    date1 = date1 || '01-01-1970'
    date2 = date2 || new Date().toLocaleDateString()
    const date1Time = new Date(date1).getTime()
    const date2Time = new Date(date2).getTime()
    if (date1 > date2) {
        return new Date(randomInt(date2Time, date1Time));
    }
    return new Date(randomInt(date1Time, date2Time));
}

/**
 * 
 * @returns {boolean}
 */
function randomBool() {
    return randomInt(0, 1) === 1;
}

/** 
 * @param {VARCHAR<36>=} carId
 * @param {boolean} useNullables
 * @returns {UndefinedAsOptional<Accident>} 
 */
function randomAccident(carId, useNullables = false) {
    if (carId === undefined) throw Error(`Car Id was undefined after insert.`);
    /** @type {UndefinedAsOptional<Accident>} */
    const accident = {
        CarId: carId,
        DateOccurred: randomDate()
    };

    if (useNullables) {
        if (randomBool()) {
            accident.IsEngineDamaged = randomBool();
        }
        if (randomBool()) {
            accident.IsExteriorDamaged = randomBool();
        }
        if (randomBool()) {
            accident.IsInteriorDamaged = randomBool();
        }
        const min = (accident.IsEngineDamaged ? 1000 : 0) + (accident.IsExteriorDamaged ? 500 : 0) + (accident.IsInteriorDamaged ? 750 : 0)
        const max = (accident.IsEngineDamaged ? 3000 : 0) + (accident.IsEngineDamaged ? 2000 : 0) + (accident.IsEngineDamaged ? 1800 : 0)

        if (randomBool()) {
            accident.CostToRepair = randomFloat(min, max);
        }
    }
    return accident;
}

/**
 * @param {boolean} useNullables
 * @param {Partial<Car>} carPresets
 * @returns {UndefinedAsOptional<Car>}
 */
function randomCar(useNullables = true, carPresets={}) {
    /** @type {UndefinedAsOptional<Car>} */
    const car = {
        Make: randomString(20),
        Model: randomString(20),
        Mileage: randomInt(10, 150000),
        Year: randomInt(2000, 2023)
    };

    if (useNullables) {
        if (randomBool()) {
            car.MPGCity = randomFloat(15, 25);
        }

        if (randomBool()) {
            car.MPGHwy = randomFloat(20, 40);
        }

        if (randomBool()) {
            car.IsTitleSalvaged = randomBool();
        }
    }

    return {
        ...car,
        ...carPresets
    };
}

/**
 * @returns {UndefinedAsOptional<Owner>}
 */
function randomOwner() {
    return {
        FirstName: randomString(12),
        LastName: randomString(12),
        DateOwnershipStarted: randomDate('01/01/2000', '01/01/2015'),
        DateOwnershipEnded: randomDate('01/01/2015', '01/01/2023'),
    };
}

/**
 * 
 * @param {MaybeArray<object>} obj 
 * @returns 
 */
function jsonify(obj) {
    if (Array.isArray(obj)) {
        return __options.verbose ? "[...]" : JSON.stringify(obj, undefined, 2).replace('\'', '');
    }
    return __options.verbose ? "..." : JSON.stringify(obj, undefined, 2).replace('\'', '');
}

/**
 * @param {string} id1name 
 * @param {string|number|undefined} id1 
 * @param {string} id2name 
 * @param {string|number|undefined} id2 
 * @returns {UndefinedAsOptional<xCarAccident>|UndefinedAsOptional<xCarOwner>}
 */
function createCrossReference(id1name, id1, id2name, id2) {
    return {
        [id1name]: id1,
        [id2name]: id2
    };
}

/** @type {{ cars: ObjectSchema<Car>, owners: ObjectSchema<Owner>, accidents: ObjectSchema<Accident> }} */
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
        IsTitleSalvaged: {
            table: "Car",
            field: "IsTitleSalvaged",
            alias: "",
            isPrimary: false,
            isIdentity: false,
            isVirtual: false,
            isNullable: false,
            isUnique: false,
            datatype: "boolean",
            defaultValue: function () {
                return false;
            }
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
        DateOwnershipStarted: {
            table: "Owner",
            field: "DateOwnershipStarted",
            alias: "",
            isPrimary: false,
            isIdentity: false,
            isVirtual: false,
            isNullable: false,
            isUnique: false,
            datatype: "date",
            defaultValue: () => undefined
        },
        DateOwnershipEnded: {
            table: "Owner",
            field: "DateOwnershipEnded",
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
    accidents: {
        Id: {
            table: "Accident",
            field: "Id",
            alias: "",
            isPrimary: true,
            isIdentity: false,
            isVirtual: false,
            isNullable: false,
            isUnique: false,
            datatype: "int",
            defaultValue: function () {
                return undefined;
            }
        },
        CarId: {
            table: "Accident",
            field: "CarId",
            alias: "",
            isPrimary: false,
            isIdentity: false,
            isVirtual: false,
            isNullable: false,
            isUnique: false,
            datatype: "int",
            defaultValue: function () {
                return undefined;
            }
        },
        DateOccurred: {
            table: "Accident",
            field: "DateOccurred",
            alias: "",
            isPrimary: false,
            isIdentity: false,
            isVirtual: false,
            isNullable: false,
            isUnique: false,
            datatype: "int",
            defaultValue: function () {
                return undefined;
            }
        },
        IsTotaled: {
            table: "Accident",
            field: "IsTotaled",
            alias: "",
            isPrimary: false,
            isIdentity: false,
            isVirtual: true,
            isNullable: false,
            isUnique: false,
            datatype: "boolean",
            defaultValue: function () {
                return undefined;
            }
        },
        IsEngineDamaged: {
            table: "Accident",
            field: "IsEngineDamaged",
            alias: "",
            isPrimary: false,
            isIdentity: false,
            isVirtual: false,
            isNullable: true,
            isUnique: false,
            datatype: "boolean",
            defaultValue: function () {
                return false;
            }
        },
        IsExteriorDamaged: {
            table: "Accident",
            field: "IsExteriorDamaged",
            alias: "",
            isPrimary: false,
            isIdentity: false,
            isVirtual: false,
            isNullable: true,
            isUnique: false,
            datatype: "boolean",
            defaultValue: function () {
                return false;
            }
        },
        IsInteriorDamaged: {
            table: "Accident",
            field: "IsInteriorDamaged",
            alias: "",
            isPrimary: false,
            isIdentity: false,
            isVirtual: false,
            isNullable: true,
            isUnique: false,
            datatype: "boolean",
            defaultValue: function () {
                return false;
            }
        },
        CostToRepair: {
            table: "Accident",
            field: "CostToRepair",
            alias: "",
            isPrimary: false,
            isIdentity: false,
            isVirtual: false,
            isNullable: true,
            isUnique: false,
            datatype: "float",
            defaultValue: function () {
                return undefined;
            }
        }
    }
};

/**
 * @template T
 * @typedef {Promise<T>|T} MaybePromise
 */

/**
 * @template T
 * @typedef {T|T[]} MaybeArray
 */

/**
 * @typedef {object} Car
 * @prop {PRIMARY<VARCHAR<36>>} Id
 * @prop {VARCHAR<20>} Make
 * @prop {VARCHAR<20>} Model
 * @prop {INT} Year
 * @prop {INT} Mileage
 * @prop {NULLABLE<FLOAT>} MPGCity
 * @prop {NULLABLE<FLOAT>} MPGHwy
 * @prop {DEFAULT<BOOLEAN, false>} IsTitleSalvaged
 * 
 * @prop {xCarOwner[]=} Owners
 * @prop {Accident[]=} Accidents
 */

/**
 * @typedef {object} Owner
 * @prop {PRIMARY<IDENTITY<INT>>} Id
 * @prop {VARCHAR<20>} FirstName
 * @prop {VARCHAR<20>} LastName
 * @prop {DATETIME} DateOwnershipStarted
 * @prop {NULLABLE<DATETIME>} DateOwnershipEnded
 * 
 * @prop {xCarOwner[]=} Owners
 */

/**
 * @typedef {object} Accident
 * @prop {PRIMARY<INT>} Id
 * @prop {FOREIGN<VARCHAR<36>, Car, "Id">} CarId
 * @prop {DATETIME} DateOccurred
 * @prop {VIRTUAL<BOOLEAN>} IsTotaled
 * @prop {DEFAULT<BOOLEAN, false>} IsEngineDamaged
 * @prop {DEFAULT<BOOLEAN, false>} IsExteriorDamaged
 * @prop {DEFAULT<BOOLEAN, false>} IsInteriorDamaged
 * @prop {NULLABLE<FLOAT>} CostToRepair
 * 
 * @prop {Car=} Car
 */

/**
 * @typedef {object} xCarOwner
 * @prop {PRIMARY<FOREIGN<VARCHAR<36>, Car, "Id">>} CarId
 * @prop {PRIMARY<FOREIGN<INT, Owner, "Id">>} OwnerId
 * 
 * @prop {Car=} Car
 * @prop {Owner=} Owner
 */

/**
 * @typedef {object} xCarAccident
 * @prop {PRIMARY<FOREIGN<VARCHAR<36>, Car, "Id">>} CarId
 * @prop {PRIMARY<FOREIGN<INT, Accident, "Id">>} AccidentId
 * 
 * @prop {Car=} Car
 * @prop {Accident=} Accident
 */


/**
 * @typedef {object} TestContexts
 * @prop {MyORMContext<UndefinedAsOptional<Car>>} cars
 * @prop {MyORMContext<UndefinedAsOptional<Owner>>} owners
 * @prop {MyORMContext<UndefinedAsOptional<Accident>>} accidents
 * @prop {MyORMContext<UndefinedAsOptional<xCarOwner>>} xCarOwners
 * @prop {MyORMContext<UndefinedAsOptional<xCarAccident>>} xCarAccidents
 */

/**
 * @template {object} T
 * @typedef {{[K in keyof T as undefined extends T[K] ? never : K]-?: Exclude<T, undefined>[K]} 
 * & {[K in keyof T as T[K] extends IDENTITY<ScalarDataType>|NULLABLE<ScalarDataType> ? K : never]?: T[K]}} UndefinedAsOptional
 */

/** @typedef {UndefinedAsOptional<Car>} X */

/** @template T @typedef {{[K in keyof T]: import('@myorm/myorm').DescribedSchema}} ObjectSchema */

// DESCRIBING DATA TYPES

/**
 * @typedef {ScalarStringDataType|ScalarDateDataType|ScalarNumericDataType} ScalarDataType
 */

/**
 * @typedef {PRIMARY<ScalarDataType>|FOREIGN<ScalarDataType, import("@myorm/myorm").SqlTable, keyof import("@myorm/myorm").SqlTable>|NULLABLE<ScalarDataType>|IDENTITY<ScalarDataType>|UNIQUE<ScalarDataType>|VIRTUAL<ScalarDataType>} Decorator
 */

/** @template {ScalarDataType|Decorator} T @typedef {T=} PRIMARY */
/** 
 * @template {ScalarDataType|Decorator} T
 * @template {import("@myorm/myorm").SqlTable} TForeignObject 
 * @template {keyof {[K in keyof TForeignObject as TForeignObject[K] extends string|number|undefined ? K : never]}} TForeignKey 
 * @typedef {T=} FOREIGN 
 */
/** @template {ScalarDataType|Decorator} T @typedef {T=} NULLABLE */
/** @template {ScalarDataType|Decorator} T @typedef {T} NON_NULLABLE */
/** @template {ScalarDataType|Decorator} T @template {T} V @typedef {T=} DEFAULT */
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