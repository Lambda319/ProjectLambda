DELETE FROM `Data-1`.`GroupMember`;
DELETE FROM `Data-1`.`GroupOwner`;
DELETE FROM `Data-1`.`Group`;
DELETE FROM `Data-1`.`Manager`;
DELETE FROM `Data-1`.`MeetingParticipant`;
DELETE FROM `Data-1`.`UserStatus`;
DELETE FROM `Data-1`.`Meeting`;
DELETE FROM `Data-1`.`User`;

ALTER TABLE `Data-1`.`Group` AUTO_INCREMENT = 1;

INSERT INTO `Data-1`.`User`
(`email`,
 `FNAME`,
 `LNAME`)
VALUES
    ("phoebe.buffay@fakemail.com","Phoebe","Buffay"),
    ("joeydoesntsharefood@fakemail.com","Joey","Tribbiani"),
    ("adelaidekoloman@zoom-dashboard.tk","Adelaide","Koloman"),
    ("admin@zoom-dashboard.tk","Zoom","Admin"),
    ("cassiemedrod@zoom-dashboard.tk","Cassie","Medrod"),
    ("sheralinora@zoom-dashboard.tk","Sherali","Nora"),
    ("rossatron@fakemail.com","Ross","Geller"),
    ("rgreene@fakemail.com","Rachel","Greene"),
    ("mrs.chanandler.bong@fakemail.com","Chandler","Bing"),
    ("monicageller@fakemail.com","Monica","Geller"),
    ("juan-guarcia@fakemail.com","Juan","Guarcia"),
    ("jz@fakemail.com","Zurbriggen","Johnsen"),
    ("amelia.campbell@fakemail.com","Amelia","Campbell"),
    ("cbaker@fakemail.com","Claire","Baker"),
    ("m.jackson@fakemail.com","Mona","Jackson"),
    ("lyana.ong@fakemail.com","Lyana","Ong"),
    ("gabriel.lim@fakemail.com","Gabriel","Lim"),
    ("herman.seah@fakemail.com","Herman","Seah"),
    ("sherilyn.chong@fakemail.com","Sherilyn","Chong"),
    ("jasmine.yeo@fakemail.com","Jasmine","Yeo"),
    ("fake.arthur.ubc@gmail.com", "Arthur", "Marques"),
    ("lieseemili@zoom-dashboard.tk", "Liese", "Emili"),
    ('cornelgurgen@zoom-dashboard.tk', 'Cornel', 'Gurgen'),
    ('liammarcel@zoom-dashboard.tk', 'Liam', 'Marcel');

INSERT INTO `Data-1`.`Meeting`
(`ID`,`StartDate`,`EndDate`,`Topic`,`HostEmail`,`DownloadLink`, `Passcode`, `Status`, `JoinURL`)
VALUES
    (1, 1648490400000, 1648501200000, "Onboarding", "admin@zoom-dashboard.tk", null, "pw-1", 2, "FakeURL"),
    (2, 1648497600000, 1648508220000, "Interviews Round A", "lieseemili@zoom-dashboard.tk", null, "pw-2", 2, "FakeURL2"),
    (3, 1648584000000, 1648595520000, "Interviews Round B", "lieseemili@zoom-dashboard.tk", null, "pw-3", 2, "FakeURL3"),
    (4, 1648659600000, 1648662480000, "Debrief Team Lambda", "lieseemili@zoom-dashboard.tk", null, "pw-4", 2, "FakeURL4"),
    (5, 1648670400000, 1648679640000, "Office Supplies Inventory", "gabriel.lim@fakemail.com", null, "pw-5", 2, "FakeURL5"),
    (6, 1648850400000, 1648852020000, "April Fools!", "amelia.campbell@fakemail.com", null, "pw-6", 2, "FakeURL6"),
    (7, 1648904400000, 1648909020000, "EMERGENCY SERVER ISSUES", "lieseemili@zoom-dashboard.tk", null, "pw-7", 2, "FakeURL7"),
    (8, 1649116800000, 1649138400000, "Central Perk Reunion Planning", "monicageller@fakemail.com", null, "pw-8", 1, "FakeURL8"),
    (9, 1649111400000, 1649124900000, "Summer Event Planning 1", "gabriel.lim@fakemail.com", null, "pw-9", 1, "FakeURL9"),
    (10, 1649120400000, 1649133000000, "Team Omega Presentation", "cbaker@fakemail.com", null, "pw-10", 1, "FakeURL10"),
    (11, 1649298600000, 1649300400000, "Team Lambda Presentation Debrief", "fake.arthur.ubc@gmail.com", null, "pw-11", 0, "FakeURL11"),
    (12, 1649300400000, 1649304000000, "Team Lama Self Debrief", "admin@zoom-dashboard.tk", null, "pw-12", 0, "FakeURL12"),
    (13, 1649430000000, 1649635200000, "Team Lambda Road Trip", "cornelgurgen@zoom-dashboard.tk", null, "pw-13", 0, "FakeURL13"),
    (14, 1649440000000, 1649635200000, "CPSC 110", "cornelgurgen@zoom-dashboard.tk", null, "pw-13", 0, "FakeURL14");


INSERT INTO `Data-1`.`UserStatus`
(`Email`, `MeetingLocation`, `IsOnline`)
VALUES

    ("monicageller@fakemail.com", 8,0),
    ("mrs.chanandler.bong@fakemail.com",8, 0),
    ("joeydoesntsharefood@fakemail.com", 8, 0),
    ("rossatron@fakemail.com", 8,0),
    ("rgreene@fakemail.com", 8,0),
    ("phoebe.buffay@fakemail.com", 8, 0),
    ("adelaidekoloman@zoom-dashboard.tk", null, 0),
    ("admin@zoom-dashboard.tk", null, 0),
    ("cassiemedrod@zoom-dashboard.tk", null, 0),
    ("sheralinora@zoom-dashboard.tk", null,0),
    ("juan-guarcia@fakemail.com", null,0),
    ("jz@fakemail.com", 10,0),
    ("amelia.campbell@fakemail.com", null,0),
    ("cbaker@fakemail.com", 10,0),
    ("m.jackson@fakemail.com", null,0),
    ("lyana.ong@fakemail.com", 9,0),
    ("gabriel.lim@fakemail.com", 9,0),
    ("herman.seah@fakemail.com", null,1),
    ("sherilyn.chong@fakemail.com", 9,0),
    ("jasmine.yeo@fakemail.com", null,1),
    ("fake.arthur.ubc@gmail.com", null, 0),
    ("lieseemili@zoom-dashboard.tk", null, 0),
    ('liammarcel@zoom-dashboard.tk', null, 0),
    ('cornelgurgen@zoom-dashboard.tk', null, 0);


INSERT INTO `Data-1`.`MeetingParticipant`
(`Email`,`MeetingID`, `WasInvited`, `Attended`, `IsInMeeting`)
VALUES
    ("phoebe.buffay@fakemail.com", 1, false, true, false),
    ("joeydoesntsharefood@fakemail.com", 1, false, true, false),
    ("rossatron@fakemail.com", 1, false, true, false),
    ("rgreene@fakemail.com", 1, false, true, false),
    ("mrs.chanandler.bong@fakemail.com", 1, false, true, false),
    ("monicageller@fakemail.com", 1, false, true, false),
    ("fake.arthur.ubc@gmail.com", 1, true, true, false),
    ("lieseemili@zoom-dashboard.tk", 1, true, true, false),
    ("cornelgurgen@zoom-dashboard.tk", 1, true, true, false),
    ("liammarcel@zoom-dashboard.tk", 1, true, true, false),
    ("adelaidekoloman@zoom-dashboard.tk", 1, true, true, false),
    ("admin@zoom-dashboard.tk", 1, true, true, false),
    ("cassiemedrod@zoom-dashboard.tk", 1, true, true, false),
    ("sheralinora@zoom-dashboard.tk", 1, true, true, false),
    ("juan-guarcia@fakemail.com", 1, true, true, false),
    ("jz@fakemail.com", 1, true, true, false),
    ("amelia.campbell@fakemail.com", 1, true, true, false),
    ("cbaker@fakemail.com", 1, true, true, false),

    ("m.jackson@fakemail.com", 1, true, true, false),
    ("lyana.ong@fakemail.com", 1, true, true, false),
    ("gabriel.lim@fakemail.com", 1, true, true, false),
    ("herman.seah@fakemail.com", 1, true, true, false),
    ("sherilyn.chong@fakemail.com", 1, true, true, false),
    ("jasmine.yeo@fakemail.com", 1, true, true, false),

    ("fake.arthur.ubc@gmail.com", 2, true, true, false),
    ("lieseemili@zoom-dashboard.tk", 2, true, true, false),
    ("cornelgurgen@zoom-dashboard.tk", 2, true, true, false),
    ("liammarcel@zoom-dashboard.tk", 2, true, true, false),
    ("adelaidekoloman@zoom-dashboard.tk", 2, true, true, false),


    ("fake.arthur.ubc@gmail.com", 3, true, true, false),
    ("lieseemili@zoom-dashboard.tk", 3, true, true, false),
    ("admin@zoom-dashboard.tk", 3, true, true, false),
    ("cassiemedrod@zoom-dashboard.tk", 3, true, true, false),
    ("sheralinora@zoom-dashboard.tk", 3, true, true, false),

    ("fake.arthur.ubc@gmail.com", 4, true, true, false),
    ("lieseemili@zoom-dashboard.tk", 4, true, true, false),
    ("cornelgurgen@zoom-dashboard.tk", 4, true, true, false),
    ("liammarcel@zoom-dashboard.tk", 4, true, true, false),
    ("adelaidekoloman@zoom-dashboard.tk", 4, true, true, false),
    ("admin@zoom-dashboard.tk", 4, true, true, false),
    ("cassiemedrod@zoom-dashboard.tk", 4, true, true, false),
    ("sheralinora@zoom-dashboard.tk", 4, true, true, false),


    ("gabriel.lim@fakemail.com", 5, true, true, false),
    ("lyana.ong@fakemail.com", 5, true, true, false),
    ("sherilyn.chong@fakemail.com", 5, true, true, false),
    ("m.jackson@fakemail.com", 5, true, true, false),

    ("amelia.campbell@fakemail.com", 6, true, true, false),
    ("herman.seah@fakemail.com", 6, false, true, false),
    ("jasmine.yeo@fakemail.com", 6, false, true, false),

    ("fake.arthur.ubc@gmail.com", 7, true, true, false),
    ("lieseemili@zoom-dashboard.tk", 7, true, true, false),

    ("phoebe.buffay@fakemail.com", 8, true, true, true),
    ("joeydoesntsharefood@fakemail.com", 8, true, true, true),
    ("rossatron@fakemail.com", 8, true, true, true),
    ("rgreene@fakemail.com", 8, true, true, true),
    ("mrs.chanandler.bong@fakemail.com", 8, true, true, true),
    ("monicageller@fakemail.com", 8, true, true, true),

    ("gabriel.lim@fakemail.com", 9, true, true, true),
    ("lyana.ong@fakemail.com", 9, true, true, false),
    ("sherilyn.chong@fakemail.com", 9, false, true, true),

    ("cbaker@fakemail.com", 10, true, true, true),
    ("jz@fakemail.com", 10, false, true, true),

    ("fake.arthur.ubc@gmail.com", 11, true, false, false),
    ("cornelgurgen@zoom-dashboard.tk", 11, true, false, false),
    ("liammarcel@zoom-dashboard.tk", 11, true, false, false),
    ("adelaidekoloman@zoom-dashboard.tk", 11, true, false, false),
    ("admin@zoom-dashboard.tk", 11, true, false, false),
    ("cassiemedrod@zoom-dashboard.tk", 11, true, false, false),
    ("sheralinora@zoom-dashboard.tk", 11, true, false, false),

    ("cornelgurgen@zoom-dashboard.tk", 12, true, false, false),
    ("liammarcel@zoom-dashboard.tk", 12, true, false, false),
    ("adelaidekoloman@zoom-dashboard.tk", 12, true, false, false),
    ("admin@zoom-dashboard.tk", 12, true, false, false),
    ("cassiemedrod@zoom-dashboard.tk", 12, true, false, false),
    ("sheralinora@zoom-dashboard.tk", 12, true, false, false),

    ("cornelgurgen@zoom-dashboard.tk", 13, true, false, false),
    ("liammarcel@zoom-dashboard.tk", 13, true, false, false),
    ("adelaidekoloman@zoom-dashboard.tk", 13, true, false, false),
    ("admin@zoom-dashboard.tk", 13, true, false, false),
    ("cassiemedrod@zoom-dashboard.tk", 13, true, false, false),
    ("sheralinora@zoom-dashboard.tk", 13, true, false, false),

    ("cornelgurgen@zoom-dashboard.tk", 14, true, false, false),
    ("lyana.ong@fakemail.com", 14, true, false, false),
    ("sherilyn.chong@fakemail.com", 14, true, false, false);




INSERT INTO `Data-1`.`Manager`
(`ManagerEmail`,
 `EmployeeEmail`)
VALUES
    ("lieseemili@zoom-dashboard.tk", "monicageller@fakemail.com"),
    ("lieseemili@zoom-dashboard.tk", "fake.arthur.ubc@gmail.com"),
    ("lieseemili@zoom-dashboard.tk", "admin@zoom-dashboard.tk"),
    ("monicageller@fakemail.com", "phoebe.buffay@fakemail.com"),
    ("monicageller@fakemail.com", "rgreene@fakemail.com"),
    ("monicageller@fakemail.com", "rossatron@fakemail.com"),
    ("monicageller@fakemail.com", "mrs.chanandler.bong@fakemail.com"),
    ("monicageller@fakemail.com",  "joeydoesntsharefood@fakemail.com"),
    ("admin@zoom-dashboard.tk", "adelaidekoloman@zoom-dashboard.tk"),
    ("admin@zoom-dashboard.tk", "cassiemedrod@zoom-dashboard.tk"),
    ("admin@zoom-dashboard.tk", "sheralinora@zoom-dashboard.tk"),
    ("fake.arthur.ubc@gmail.com", "amelia.campbell@fakemail.com"),
    ("fake.arthur.ubc@gmail.com", "cbaker@fakemail.com"),
    ("fake.arthur.ubc@gmail.com",  "gabriel.lim@fakemail.com"),
    ("amelia.campbell@fakemail.com", "herman.seah@fakemail.com"),
    ("amelia.campbell@fakemail.com", "jasmine.yeo@fakemail.com"),
    ("cbaker@fakemail.com", "jz@fakemail.com"),
    ("gabriel.lim@fakemail.com", "lyana.ong@fakemail.com"),
    ("gabriel.lim@fakemail.com", "sherilyn.chong@fakemail.com"),
    ("sheralinora@zoom-dashboard.tk", "cornelgurgen@zoom-dashboard.tk"),
    ("fake.arthur.ubc@gmail.com", "liammarcel@zoom-dashboard.tk"),
    ("sherilyn.chong@fakemail.com", "m.jackson@fakemail.com");

INSERT INTO `Data-1`.`Group`
(`Name`,
 `isFavorite`)
VALUES
    ("Fav", true),
    ("Fav", true),
    ("Fav", true),
    ("Fav", true),
    ("Fav", true),
    ("Fav", true),
    ("-1", false),
    ("-2", false),
    ("-5", false),
    ("Fav", true),
    ("Fav", true),
    ("Fav", true),
    ("Fav", true);

INSERT INTO `Data-1`.`GroupOwner`
(`GroupID`, `OwnerEmail`)
VALUES
    (1, "joeydoesntsharefood@fakemail.com"),
    (2, "mrs.chanandler.bong@fakemail.com"),
    (3, "admin@zoom-dashboard.tk"),
    (4, "adelaidekoloman@zoom-dashboard.tk"),
    (5, "cassiemedrod@zoom-dashboard.tk"),
    (6, "sheralinora@zoom-dashboard.tk"),
    (7, "joeydoesntsharefood@fakemail.com"),
    (8, "mrs.chanandler.bong@fakemail.com"),
    (9, "cassiemedrod@zoom-dashboard.tk"),
    (10, "fake.arthur.ubc@gmail.com"),
    (11, "lieseemili@zoom-dashboard.tk"),
    (12, "liammarcel@zoom-dashboard.tk"),
    (13, "cornelgurgen@zoom-dashboard.tk");


INSERT INTO `Data-1`.`Meeting`
(`ID`,`StartDate`,`EndDate`,`Topic`,`HostEmail`,`DownloadLink`,`JoinURL`,`Passcode`,`Status`,`Timestamp`)
VALUES
    ('87063243708', '1649121000000', '1649123700000', 'Recorded Meeting', 'admin@zoom-dashboard.tk', NULL, 'https://us02web.zoom.us/j/87063243708?pwd=SzVyaVZsVWV2cjRjbDllbGNZTTZiQT09', '318529', '2', '1649109007372'),
    ('83901045129', '1649122849000', '1649131249000', 'Marketing Meeting', 'admin@zoom-dashboard.tk', NULL, 'https://us02web.zoom.us/j/83901045129?pwd=bEJrcGtBL2xMVzJkL1czK3BLWldHZz09', '622646', '0', '0'),
    ('82159289079', '1649123580000', '1649131249000', 'Finance Meeting', 'admin@zoom-dashboard.tk', NULL, 'https://us02web.zoom.us/j/82159289079?pwd=TUhXWWRyNGlRK1ZETUJRbEJXQjRPQT09', '439491', '0', '0');


INSERT INTO `Data-1`.`MeetingParticipant`
(`Email`,`MeetingID`,`WasInvited`,`Attended`,`IsInMeeting`,`Timestamp`)
VALUES
    ("admin@zoom-dashboard.tk", 87063243708, 1, 1, 0, 1649109009749),
    ('admin@zoom-dashboard.tk', '83901045129', '1', '0', '0', '0'),
    ('cassiemedrod@zoom-dashboard.tk', '83901045129', '1', '0', '0', '0'),
    ('sheralinora@zoom-dashboard.tk', '83901045129', '1', '0', '0', '0'),
    ('cornelgurgen@zoom-dashboard.tk', '82159289079', '1', '0', '0', '0'),
    ('admin@zoom-dashboard.tk', '82159289079', '1', '0', '0', '0'),
    ('adelaidekoloman@zoom-dashboard.tk', '82159289079', '1', '0', '0', '0');


INSERT INTO `Data-1`.`MeetingRecording`
(`MeetingID`,
 `PlayURL`,
 `RecordingTime`)
VALUES
    (87063243708,
     "https://us02web.zoom.us/rec/play/PU_8tGjv981WF0pKCRqu_4FPxVfGFd4BuBml5I_Mb8sEGbvfi9d52SCfQyq6PVqwsp0lHB9z7pJloxnU.F6CZxqfU4JRMPOdd",
     1649108984000);



