<!-- -->

app.controller('WebSecBugsController', function ($scope, $http, sessionService, bugzillaService) {

    $scope.loading = true;

    const MOCO_SITES = ["www.mozilla.com", "plugins.mozilla.org", "forums.mozilla.org", "addons.mozilla.org", "developer.mozilla.org", "vreplay.mozilla.com"];
    const MOFO_SITES = ["www.drumbeat.org", "donate.mozilla.org", "thimble.webmaker.org", "2011.mozillafestival.org", "popcorn.webmadecontent.org", "popcorn.webmaker.org"];
    const THIRD_PARTY_SITES = ["vreplay.mozilla.org"];

    $scope.filterName = "all";
    $scope.sortName = "count";

    var countTotalBugs = function()
    {
        return _.chain($scope.sites)
            .map(function (site) {return site.new + site.unconfirmed;})
            .reduce(function (memo, num) {return memo + num;}, 0)
            .value();
    };

    $scope.filter = function(what)
    {
        $scope.filterName = what;

        switch (what) {
            case "all": {
                $scope.sites = $scope.allSites;
                break;
            }
            case "moco": {
                $scope.sites = _.filter($scope.allSites, function(site) {return MOCO_SITES.indexOf(site.name) != -1;});
                break;
            }
            case "mofo": {
                $scope.sites = _.filter($scope.allSites, function(site) {return  MOFO_SITES.indexOf(site.name) != -1;});
                break;
            }
            case "thirdparty": {
                $scope.sites = _.filter($scope.allSites, function(site) {return THIRD_PARTY_SITES.indexOf(site.name) != -1;});
            }
        }

        $scope.sitesBugCount = countTotalBugs();
        $scope.sort($scope.sortName);
    };

    $scope.sort = function(what)
    {
        $scope.sortName = what;

        switch (what) {
            case "count": {
                $scope.sites = _.sortBy($scope.sites, function(site) { return site.unconfirmed + site.new; }).reverse();
                break;
            }
            case "age": {
                $scope.sites = _.sortBy($scope.sites, function(site) { return site.averageAge; }).reverse();
                break;
            }
            case "name": {
                $scope.sites = _.sortBy($scope.sites, function(site) { return site.name; });
                break;
            }
        }
    };

    $scope.reload = function()
    {
        $scope.bugs = [];
        $scope.sites = {};
        $scope.sitesBugCount = 0;
        $scope.projectReviewBugs = [];
        $scope.blockingBugs = {};

        // First we get the project review bugs

        var options = {
            include_fields:"id,creation_time,summary,status,resolution,whiteboard,assigned_to",
            advanced: [["status_whiteboard", "substring", "[site:"], ["bug_group", "substring", "websites-security"]],
            credentials: sessionService.getCredentials()
        };

        var parseSites = function parseSites(s) {
            var sites = [];
            _.each(s.match(/(\[site:(.+?)\])/gi), function (match) {
                sites.push(/\[site:(.+?)\]/.exec(match)[1]);
            });
            return sites;
        };

        bugzillaService.getBugs(options)
            .success(function(data) {
                $scope.bugs = data.bugs;
                $scope.loading = false;

                var shortStatus = function(bug) {
                    switch (bug.status) {
                    case "UNCONFIRMED":
                        return {status: "UNC", color: "info"};
                    case "NEW":
                        return {status: "NEW", color: "info"};
                    case "RESOLVED":
                        return {status: bug.resolution.substr(0,3), color: "default"};
                    case "VERIFIED":
                        return {status: bug.resolution.substr(0,3), color: "default"};
                    case "REOPENED":
                        return {status: "NEW", color: "info"};
                    case "ASSIGNED":
                        return {status: "ASS", color: "info"};
                    }
                    return {status: "UNK", color: "default"};
                };

                // Loop over all bugs and group sites

                var sites = {};
                _.each($scope.bugs, function(bug) {
                    if (bug.status === 'UNCONFIRMED' || bug.status === 'NEW' || bug.status === "REOPENED" || bug.status == "ASSIGNED") {
                        bugzillaService.cleanupBug(bug);
                        bug.shortStatus = shortStatus(bug).status;
                        bug.shortStatusColor = shortStatus(bug).color;
                        _.each(parseSites(bug['whiteboard']), function (site) {
                            if (!sites[site]) {
                                sites[site] = {name:site,unconfirmed:0,resolved:0,new:0,verified:0,averageAge:0,bugs:[]};
                            }
                            sites[site].bugs.push(bug);
                            sites[site][bug.status.toLowerCase()]++;
                            sites[site].averageAge += bug.age;
                        });
                    }
                });

                _.each(sites, function(site) {
                    site.averageAge = Math.floor(site.averageAge / (site.new + site.unconfirmed));
                    site.averageAgeLabel = "default";
                    if (site.averageAge < 7) {
                        site.averageAgeLabel = "success";
                    } else if (site.averageAge< 24) {
                        site.averageAgeLabel = "warning";
                    } else {
                        site.averageAgeLabel = "important";
                    }
                    site.bugzillaAllOpenBugsLink = "https://bugzilla.mozilla.org/buglist.cgi?type0-1-0=substring;field0-1-0=status_whiteboard;field0-0-0=bug_group;query_format=advanced;value0-1-0=[site%3A" + site.name + "];bug_status=UNCONFIRMED;bug_status=NEW;type0-0-0=equals;value0-0-0=websites-security";
                });

                $scope.allSites = _.chain(sites)
                    .values()
                    .filter(function (site) { return site.new > 0 || site.unconfirmed > 0 })
                    .value();

                $scope.filter('all');
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
