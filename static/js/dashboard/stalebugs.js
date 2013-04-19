<!-- -->

app.controller('StaleBugsController', function ($scope, $http, bugzillaService, sessionService) {

    $scope.loading = true;

    $scope.logout = function() {
        bugzillaService.logout();
    };

    $scope.filterName = "mine";
    $scope.sortName = undefined;

    $scope.filter = function(what) {
        $scope.filterName = what;

        switch (what) {
            case "all": {
                $scope.bugs = $scope.allBugs;
                break;
            }
            case "mine": {
                var username = sessionService.getCredentials().username;
                $scope.bugs = _.filter($scope.allBugs, function(bug) {return bug.assigned_to.name === username;});
                break;
            }
            case "unassigned": {
                $scope.bugs = _.filter($scope.allBugs, function(bug) {return !bug.isAssigned();});
                break;
            }
        }

        $scope.sort($scope.sortName);
    };

    $scope.sort = function(what) {
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
        $scope.sortName = what;
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
            status: ["UNCONFIRMED", "NEW", "ASSIGNED", "REOPENED"],
            include_fields:"id,creation_time,summary,status,assigned_to",
            advanced: [["days_elapsed", "greaterthaneq", "28"]],
            credentials: sessionService.getCredentials()
        };

        bugzillaService.getBugs(options)
            .success(function(data) {
                $scope.allBugs = data.bugs;
                $scope.loading = false;

                _.each($scope.allBugs, function(bug) {
                    bugzillaService.cleanupBug(bug);
                });

                $scope.filter(bugzillaService.isAnonymous() ? 'all' : 'mine');
                $scope.sort('age');
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
