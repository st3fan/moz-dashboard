<!-- -->

app.controller('ReviewsController', function ($scope, $http, bugzillaService, sessionService) {

    $scope.loading = true;

    $scope.logout = function() {
        bugzillaService.logout();
    };

    $scope.filterName = "all";
    $scope.sortName = "age";

    $scope.filter = function(what) {
        $scope.filterName = what;

        switch (what) {
            case "all": {
                $scope.bugs = $scope.allBugs;
                break;
            }
            case "mine": {
                $scope.bugs = _.filter($scope.allBugs, function(bug) {return bug.assigned_to.name === sessionService.getCredentials().username;});
                break;
            }
            case "assigned": {
                $scope.bugs = _.filter($scope.allBugs, function(bug) {
                    return bug.assigned_to.name !== "nobody@mozilla.org" && bug.assigned_to.name !== "nobody";
                });
                break;
            }
            case "unassigned": {
                $scope.bugs = _.filter($scope.allBugs, function(bug) {
                    return bug.assigned_to.name === "nobody@mozilla.org" || bug.assigned_to.name === "nobody";
                });
                break;
            }
        }

        $scope.sort($scope.sortName);
    };

    $scope.sort = function(what) {
        $scope.sortName = what;

        switch (what) {
            case "age": {
                $scope.bugs = _.sortBy($scope.bugs, function(bug) { return bug.age; }).reverse();
                break;
            }
            case "assignee": {
                $scope.bugs = _.sortBy($scope.bugs, function(bug) { return bug.assigned_to.name; });
                break;
            }
        }
    };

    $scope.reload = function()
    {
        $scope.bugs = [];
        $scope.sites = {};
        $scope.projectReviewBugs = [];
        $scope.blockingBugs = {};

        // First we get the project review bugs

        var options = {
            product: "mozilla.org",
            component: "Security Assurance: Review Request",
            status: ["UNCONFIRMED", "NEW", "ASSIGNED"],
            include_fields:"id,creation_time,summary,status,assigned_to",
            credentials: sessionService.getCredentials()
        };

        bugzillaService.getBugs(options)
            .success(function(data) {
                $scope.allBugs = data.bugs;
                $scope.loading = false;

                _.each($scope.allBugs, function(bug) {
                    bugzillaService.cleanupBug(bug);
                });

                $scope.sort('age');
                $scope.filter(bugzillaService.isAnonymous() ? 'all' : 'mine');
            })
            .error(function (data, status) {
                console.log("Error getting bugs", data, status);
            });
    };

    $scope.$on('$viewContentLoaded', function() {
        if (!$scope.bugs) {
            $scope.reload();
        }
    });
});
