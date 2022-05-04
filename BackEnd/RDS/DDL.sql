CREATE DATABASE `Data-1` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

CREATE TABLE `User` (
                        `Email` varchar(80) NOT NULL,
                        `FName` varchar(40) NOT NULL,
                        `LName` varchar(40) NOT NULL,
                        PRIMARY KEY (`Email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `UserStatus` (
                              `Email` varchar(80) NOT NULL,
                              `MeetingLocation` decimal(20,0) DEFAULT NULL,
                              `IsOnline` tinyint NOT NULL DEFAULT '0',
                              `Status` varchar(100) DEFAULT NULL,
                              `OnlineTimestamp` bigint NOT NULL DEFAULT '0',
                              `MeetingLocationTimestamp` bigint NOT NULL DEFAULT '0',
                              PRIMARY KEY (`Email`),
                              KEY `MID_idx` (`MeetingLocation`),
                              KEY `Mixed` (`Email`,`MeetingLocation`,`IsOnline` DESC),
                              CONSTRAINT `MID` FOREIGN KEY (`MeetingLocation`) REFERENCES `Meeting` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE,
                              CONSTRAINT `UEmail` FOREIGN KEY (`Email`) REFERENCES `User` (`Email`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `Manager` (
                           `ManagerEmail` varchar(80) NOT NULL,
                           `EmployeeEmail` varchar(80) NOT NULL,
                           PRIMARY KEY (`ManagerEmail`,`EmployeeEmail`),
                           KEY `EmployeeEmail_idx` (`EmployeeEmail`),
                           CONSTRAINT `EmployeeEmail` FOREIGN KEY (`EmployeeEmail`) REFERENCES `User` (`Email`) ON UPDATE CASCADE,
                           CONSTRAINT `ManagerEmail` FOREIGN KEY (`ManagerEmail`) REFERENCES `User` (`Email`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `Meeting` (
                           `ID` decimal(20,0) NOT NULL,
                           `StartDate` bigint NOT NULL,
                           `EndDate` bigint NOT NULL,
                           `Topic` varchar(100) NOT NULL,
                           `HostEmail` varchar(80) NOT NULL,
                           `DownloadLink` varchar(300) DEFAULT NULL,
                           `JoinURL` varchar(300) DEFAULT NULL,
                           `Passcode` varchar(40) NOT NULL,
                           `Status` int unsigned NOT NULL DEFAULT '0' COMMENT '0 = scheduled, 1 = in progress, 2 = ended',
                           `Timestamp` bigint NOT NULL DEFAULT '0',
                           PRIMARY KEY (`ID`),
                           KEY `HostEmail_idx` (`HostEmail`),
                           KEY `Time_idx` (`StartDate`),
                           CONSTRAINT `HostEmail` FOREIGN KEY (`HostEmail`) REFERENCES `User` (`Email`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `MeetingParticipant` (
                                      `Email` varchar(80) NOT NULL,
                                      `MeetingID` decimal(20,0) NOT NULL,
                                      `WasInvited` tinyint NOT NULL DEFAULT '0',
                                      `Attended` tinyint NOT NULL DEFAULT '0',
                                      `IsInMeeting` tinyint NOT NULL DEFAULT '0',
                                      `Timestamp` bigint NOT NULL DEFAULT '0',
                                      PRIMARY KEY (`Email`,`MeetingID`),
                                      KEY `MeetingID_idx` (`MeetingID`),
                                      KEY `Email_idx` (`Email`),
                                      CONSTRAINT `Email` FOREIGN KEY (`Email`) REFERENCES `User` (`Email`) ON UPDATE CASCADE,
                                      CONSTRAINT `MeetingID` FOREIGN KEY (`MeetingID`) REFERENCES `Meeting` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `MeetingRecording` (
                                    `MeetingID` decimal(20,0) NOT NULL,
                                    `PlayURL` varchar(300) NOT NULL DEFAULT 'in_progress',
                                    `RecordingTime` varchar(45) NOT NULL,
                                    PRIMARY KEY (`MeetingID`,`RecordingTime`),
                                    CONSTRAINT `MeetingIDRecording` FOREIGN KEY (`MeetingID`) REFERENCES `Meeting` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `Group` (
                         `ID` int NOT NULL AUTO_INCREMENT,
                         `Name` varchar(45) NOT NULL,
                         `IsFavorite` tinyint NOT NULL DEFAULT '0',
                         PRIMARY KEY (`ID`),
                         KEY `ID_idx` (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `GroupMember` (
                               `ID` int NOT NULL,
                               `UserEmail` varchar(80) NOT NULL,
                               PRIMARY KEY (`ID`,`UserEmail`),
                               KEY `UserEmail_idx` (`UserEmail`),
                               KEY `ID_idx` (`ID`),
                               CONSTRAINT `GroupMemberID` FOREIGN KEY (`ID`) REFERENCES `Group` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE,
                               CONSTRAINT `UserEmail` FOREIGN KEY (`UserEmail`) REFERENCES `User` (`Email`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `GroupOwner` (
                              `OwnerEmail` varchar(80) NOT NULL,
                              `GroupID` int NOT NULL,
                              PRIMARY KEY (`OwnerEmail`,`GroupID`),
                              KEY `GroupOwnerID_idx` (`GroupID`),
                              CONSTRAINT `GroupOwnerEmail` FOREIGN KEY (`OwnerEmail`) REFERENCES `User` (`Email`) ON DELETE CASCADE ON UPDATE CASCADE,
                              CONSTRAINT `GroupOwnerID` FOREIGN KEY (`GroupID`) REFERENCES `Group` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE VIEW `MeetingHost` AS
SELECT `m`.`ID` AS `ID`, `u`.`Email` AS `Email`, concat(`u`.`FName`, ' ', `u`.`LName`) AS `Name`
FROM (`Meeting` `m`
         JOIN `User` `u`
              ON ((`m`.`HostEmail` = `u`.`Email`)));

CREATE VIEW `Favorites` AS
SELECT `g`.`OwnerID` AS `OwnerID`, `gm`.`UserEmail` AS `email`
FROM (`GroupMember` `gm`
         JOIN `Group` `g` ON ((`g`.`ID` = `gm`.`ID`)));

CREATE VIEW MeetingDetails AS
SELECT m.ID, StartDate, EndDate, Topic, HostEmail, Passcode, JoinURL, `Status`,  Name as MeetingHost, Recordings as Downloadlink
FROM Meeting m
         INNER JOIN MeetingHost mh ON mh.ID = m.ID
         LEFT JOIN Recordings r ON r.MeetingID = m.ID

CREATE VIEW UserLocation AS
SELECT concat(FName,' ',LName) AS Name, us.Email, Topic, m.ID AS MeetingID
FROM UserStatus us
         JOIN User u ON u.Email = us.Email
         LEFT JOIN Meeting m on m.ID = us.MeetingLocation;