DROP DATABASE vehicles IF EXISTS;
CREATE DATABASE vehicles IF NOT EXISTS;

USE vehicles;

CREATE TABLE Car (
    Id VARCHAR(36) NOT NULL,
    Make VARCHAR(20) NOT NULL,
    Model VARCHAR(20) NOT NULL,
    Year INT NOT NULL,
    Mileage INT NOT NULL,
    MPGHwy FLOAT,
    MPGCity FLOAT,
    IsTitleSalvaged BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (Id)
);

CREATE TABLE Owner (
    Id INT AUTO_INCREMENT,
    FirstName VARCHAR(20) NOT NULL,
    LastName VARCHAR(20) NOT NULL,
    DateOwnershipStarted DATETIME NOT NULL,
    DateOwnershipEnded DATETIME
);

CREATE TABLE Accident (
    Id INT NOT NULL,
    CarId INT NOT NULL,
    DateOccurred DATETIME NOT NULL,
    IsEngineDamaged BOOLEAN DEFAULT FALSE,
    IsExteriorDamaged BOOLEAN DEFAULT FALSE,
    IsInteriorDamaged BOOLEAN DEFAULT FALSE,
    IsTotaled BOOLEAN GENERATED ALWAYS AS (IsEngineDamaged AND IsExteriorDamaged AND IsInteriorDamaged),
    CostToRepair FLOAT,
    PRIMARY KEY (CarId),
    FOREIGN KEY (CarId) REFERENCES Car (Id)
);

CREATE TABLE xCarOwners (
    CarId VARCHAR(36) NOT NULL,
    OwnerId INT NOT NULL,
    PRIMARY KEY (CarId, OwnerId),
    FOREIGN KEY (CarId) REFERENCES Car (Id),
    FOREIGN KEY (OwnerId) REFERENCES Owner (Id)
);