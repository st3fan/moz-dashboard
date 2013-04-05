<!-- -->

app.controller('KickoffController', function ($scope, $http, bugzillaService) {

    $scope.loading = true;

    // TODO Do not filter on blocker bugs that are resolved

    var filterByStatus = function(bug) {
        return bug.status === "NEW" || bug.status === "REOPENED" || bug.status == "ASSIGNED";
    };

    var sortByAge = function(bug) {
        return bug.age;
    };

    var filterByProduct = function(product) {
        return function(bug) {
            bug.product === product;
        };
    };

    var filterByProductAndComponent = function(product, component) {
        return function(bug) {
            for (var i = 0; i < bug.depends_on.length; i++) {
                var blockingBug = bug.depends_on[i];
                if (blockingBug.status == "NEW" || blockingBug.status == "REOPENED") {
                    if (blockingBug.product === product && blockingBug.component === component) {
                        return true;
                    }
                }
            }
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
            include_fields:"id,status,summary,depends_on,creation_time"
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
                    include_fields:"id,status,summary,product,component,resolution"
                }

                bugzillaService.getBugs(options)
                    .success(function(data) {
                        console.log("Loading bugs took ", (Date.now() - startTime) / 1000.0);

                        // Store all the blockers in a map
                        _.each(data.bugs, function (bug) {
                            $scope.blockingBugsById[bug.id] = bug;
                        });

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
