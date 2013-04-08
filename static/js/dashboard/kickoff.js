<!-- -->

app.controller('KickoffController', function ($scope, $http, bugzillaService) {

    $scope.tab = "open";
    $scope.loading = true;

    $scope.showTab = function(tabName)
    {
        $scope.tab = tabName;
    };

    // TODO Do not filter on blocker bugs that are resolved

    var filterByStatus = function(bug) {
        return bug.status === "NEW" || bug.status === "REOPENED" || bug.status == "ASSIGNED";
    };

    var sortByAge = function(bug) {
        return bug.age;
    };

    var filterByProduct = function(product) {
        return function(bug) {
            return bug.product === product;
        };
    };

    var filterByProductAndComponent = function(product, component) {
        return function(bug) {
            for (var i = 0; i < bug.depends_on.length; i++) {
                var blockingBug = bug.depends_on[i];
                if (blockingBug.status == "NEW" || blockingBug.status == "REOPENED" || blockingBug.status == "ASSIGNED") {
                    if (blockingBug.product === product && blockingBug.component === component) {
                        return true;
                    }
                }
            }
            return undefined;
        };
    };

    var filterInvalidBugs = function(bug) {
        return bug.depends_on.length > 0;
    };

    var filterProjectReviewBugs = function(projectReviewBugs, filter) {
        if (!filter) {
            filter = function (bug) { return true; };
        }
        return _.chain(projectReviewBugs).filter(filterInvalidBugs).filter(filterByStatus).filter(filter).sortBy(sortByAge).reverse().value();
    };

    $scope.filterBy = function(what)
    {
        switch (what)
        {
            case 'all':
                $scope.bugs = filterProjectReviewBugs($scope.projectReviewBugs, undefined);
                break;
            case 'security':
                $scope.bugs = filterProjectReviewBugs($scope.projectReviewBugs, filterByProductAndComponent("mozilla.org", "Security Assurance: Review Request"));
                break;
            case 'legal':
                $scope.bugs = filterProjectReviewBugs($scope.projectReviewBugs, filterByProduct("Legal"));
                break;
            case 'privacy':
                $scope.bugs = filterProjectReviewBugs($scope.projectReviewBugs, filterByProductAndComponent("Privacy", "Product Review"));
                break;
            case 'data':
                $scope.bugs = filterProjectReviewBugs($scope.projectReviewBugs, filterByProductAndComponent("Data Safety", "General"));
                break;
            case 'finance':
                $scope.bugs = filterProjectReviewBugs($scope.projectReviewBugs, filterByProductAndComponent("Finance", "Purchase Request Form"));
                break;
        }

        $scope.filter = what;
    };




    var shortStatus = function(bug) {
        switch (bug.status) {
            case "NEW":
                return {status: "NEW", color: "info"};
                break;
            case "RESOLVED":
                return {status: bug.resolution.substr(0,3), color: "default"};
                break;
            case "VERIFIED":
                return {status: bug.resolution.substr(0,3), color: "default"};
                break;
            case "REOPENED":
                return {status: "NEW", color: "info"};
                break;
            case "ASSIGNED":
                return {status: "ASS", color: "info"};
                break;
        }
        return {status: "UNK", color: "default"};
    };




    // Calculate statistics

    var teamForBug = function (bug) {
        if (bug.product == 'mozilla.org' && bug.component == 'Security Assurance: Review Request') {
            return 'security';
        }
        if (bug.product === 'Legal') {
            return 'legal';
        }
        if (bug.product === 'Privacy') {
            return 'privacy';
        }
        if (bug.product === 'Data Safety') {
            return 'data';
        }
        if (bug.product === 'Finance') {
            return 'finance';
        }
        return 'other';
    };

    var createKickoffStats = function (bugs, quarter) {
        return {};
    };

    var createProjectStats = function (bugs) {
        var projectStats = { total: 0, open: 0, resolved: 0 };
        _.each(bugs, function (bug) {
            projectStats.total++;
            if (_.contains(['NEW', 'REOPENED', 'ASSIGNED'], bug.status)) {
                projectStats.open++;
            } else if (_.contains(['RESOLVED', 'VERIFIED'], bug.status)) {
                projectStats.resolved++;
            }
        });
        return projectStats;
    };

    var isProjectReviewBug = function (bug) {
        return bug.product === 'mozilla.org' && bug.component == 'Project Review';
    };

    var warpBugToDate = function (bug, date)
    {
        // TODO Find out how to clone something in JavaScript
        var warpedBug = {
            id: bug.id,
            summary: bug.summary,
            status: bug.status,
            resolution: bug.resolution,
            depends_on: bug.depends_on,
            creation_time: bug.creation_time,
            product: bug.product,
            component: bug.component
        };

        var warpedHistory = [];
        _.chain(bug.history).reverse().each(function (event) {
            if (event.change_time >= date) {
                _.each(event.changes, function (change) {
                    switch (change.field_name) {
                        case 'status':
                            warpedBug.status = change.removed;
                            break;
                        case 'resolution':
                            warpedBug.resolution = change.removed;
                            break;
                        case 'summary':
                            warpedBug.summary = change.remove;
                            break;
                    }
                });
            } else {
                warpedHistory.splice(0, 0, event);
            }
        });
        warpedBug.history = warpedHistory;

        return warpedBug;
    };

    var warpBugsToDate = function (bugs, date) {
        return _.chain(bugs)
            //.filter(function (bug) { return bug.creation_time <= date; })
            .map(function (bug) { return warpBugToDate(bug, date); })
            .value();
    };

    var filterBugsByCreationDateRange = function (bugs, range) {
        return _.filter(bugs, function (bug) {
            return bug.creation_time >= range.start && bug.creation_time <= range.end;
        });
    };

    var createQuarterlyStats = function (projectBugs, teamBugs) {
        var dateRanges = [
            // TODO Generate these from first known quarter till now.
            moment().range(moment("2012-10-01 00:00:00"), moment("2012-12-31 23:59:59")),
            moment().range(moment("2013-01-01 00:00:00"), moment("2013-03-31 23:59:59")),
            moment().range(moment("2013-04-01 00:00:00"), moment("2013-06-31 23:59:59"))
        ];
        return _.map(dateRanges, function (range) {
            var projectStats = createProjectStats(filterBugsByCreationDateRange(warpBugsToDate(projectBugs, range.end), range));
            var teamStats = createTeamStats(filterBugsByCreationDateRange(warpBugsToDate(projectBugs, range.end), range),
                                            filterBugsByCreationDateRange(warpBugsToDate(teamBugs, range.end), range));
            return { range: range, projectStats: projectStats, teamStats: teamStats };
        });
    };

    var createTeamStats = function (projectBugs, teamBugs)
    {
        var teamStats = [];
        var teamStatsByTeam = {};
        _.each(['security', 'legal', 'privacy', 'data', 'finance', 'other', 'hidden'], function (team) {
            var stats = { team: team, total: 0, open: 0, resolved_fixed: 0, resolved_invalid: 0, resolved_other: 0 };
            teamStats.push(stats);
            teamStatsByTeam[team] = stats;
        });

        var teamBugsById = {};
        _.each(teamBugs, function (teamBug) {
            teamBugsById[teamBug.id] = teamBug;
        });

        _.each(projectBugs, function (projectBug) {
            _.each(projectBug.depends_on, function (teamBug) {
                if (teamBug.status) {
                    var team = teamForBug(teamBug);
                    teamStatsByTeam[team].total++;
                    if (_.contains(['NEW', 'REOPENED', 'ASSIGNED'], teamBug.status)) {
                        teamStatsByTeam[team].open++;
                    } else if (_.contains(['RESOLVED', 'VERIFIED'], teamBug.status)) {
                        switch (teamBug.resolution) {
                            case 'FIXED':
                                teamStatsByTeam[team].resolved_fixed++;
                                break;
                            case 'INVALID':
                                teamStatsByTeam[team].resolved_invalid++;
                                break;
                            default:
                                teamStatsByTeam[team].resolved_other++;
                        }
                    }
                } else {
                    teamStatsByTeam['hidden'].total++;
                }
            });
        });

        return teamStats;
    };







    $scope.reload = function()
    {
        $scope.bugs = [];
        $scope.projectReviewBugs = [];
        $scope.blockingBugsById = {};

        // First we get the project review bugs

        var options = {
            component:"Project Review",
            product:"mozilla.org",
            //status: ["NEW", "REOPENED"],
            include_fields:"id,status,summary,depends_on,creation_time,history,resolution"
        };

        var startTime = Date.now();

        bugzillaService.getBugs(options)
            .success(function(data) {
                $scope.projectReviewBugs = data.bugs;

                // Clean up all the bugs
                _.each($scope.projectReviewBugs, function (bug) {
                    bugzillaService.cleanupBug(bug);
                });

                // Then we get all the blocking bugs

                var blockingBugIds = _.chain($scope.projectReviewBugs).map(function (bug) {
                    return bug.depends_on ? bug.depends_on : [];
                }).flatten().value();

                var options = {
                    id: blockingBugIds.join(","),
                    include_fields:"id,creation_time,status,summary,product,component,resolution,depends_on,history"
                };

                bugzillaService.getBugs(options)
                    .success(function(data) {
                        console.log("Loading bugs took ", (Date.now() - startTime) / 1000.0);

                        // Store all the blockers in a map
                        $scope.blockingBugs = data.bugs;
                        _.each(data.bugs, function (bug) {
                            bugzillaService.cleanupBug(bug);
                            $scope.blockingBugsById[bug.id] = bug;
                        });

                        // Loop over all review bugs and replace the dependend bug numbers with real bug records
                        _.each($scope.projectReviewBugs, function (bug) {
                            _.each(bug.depends_on, function (blockingBugId, idx) {
                                if ($scope.blockingBugsById[blockingBugId]) {
                                    bug.depends_on[idx] = $scope.blockingBugsById[blockingBugId];
                                    bug.depends_on[idx].shortStatus = shortStatus(bug.depends_on[idx]).status;
                                    bug.depends_on[idx].shortStatusColor = shortStatus(bug.depends_on[idx]).color;
                                } else {
                                    bug.depends_on[idx] = {summary:"Unavailable", id: blockingBugId, shortStatus: "UNK", shortStatusColor: "info"};
                                }
                            });
                        });

                        // Display all bugs by default
                        $scope.loading = false;
                        $scope.filterBy('all');

                        $scope.quarterlyStats = createQuarterlyStats($scope.projectReviewBugs, $scope.blockingBugs);
                    });
            })
            .error(function(data, status, headers, config) {
                console.log("Error getting bugs", data, status);
            });
    };

    $scope.$on('$viewContentLoaded', function() {
        if (!$scope.bugs) {
            $scope.reload();
        }
    });
});
