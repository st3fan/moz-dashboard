var app = angular.module("dashboard", []);

app.run(function($rootScope, $location, sessionService, bugzillaService) {
    $rootScope.ready = false;
    $rootScope.loggedIn = false;

    $rootScope.$on("BugzillaLoginSuccess", function (event, args) {
        sessionService.setCredentials(args.credentials);
        $rootScope.ready = true;
        $rootScope.loggedIn = true;
    });

    $rootScope.$on("BugzillaLogoutSuccess", function () {
        sessionService.clearCredentials();
        $rootScope.loggedIn = false;
    });

    $rootScope.ready = true;

    var credentials = sessionService.getCredentials();
    if (credentials) {
        $rootScope.loggedIn = true;
    } else {
        $location.path("/").replace();
    }
});

app.config(function($routeProvider, $locationProvider) {
    $locationProvider.hashPrefix('!');
    $routeProvider
        .when("/", { templateUrl: "partials/index.html" })
        .when("/websecbugs", { templateUrl: "partials/websecbugs.html", controller: "WebSecBugsController" })
        .when("/reviews", { templateUrl: "partials/reviews.html", controller: "ReviewsController" })
        .when("/kickoff", { templateUrl: "partials/kickoff.html", controller: "KickoffController" });
});

app.controller('SigninController', function($scope, $rootScope, $http, bugzillaService, preferencesService) {
    $scope.bugzillaService = bugzillaService;
    $scope.error = undefined;

    $scope.username = "";
    $scope.password = "";
    $scope.rememberMe = undefined;

    if (preferencesService.getUsername() != "") {
        $scope.username = preferencesService.getUsername();
        $scope.rememberMe = true;
    }

    $scope.signin = function() {
        $scope.error = undefined;
        bugzillaService.login($scope.username, $scope.password);
    };

    $scope.anonymous = function() {
        $scope.error = undefined;
        bugzillaService.login("nobody@mozilla.org", undefined);;
    };

    $scope.$on("BugzillaLoginSuccess", function() {
        if ($scope.rememberMe) {
            preferencesService.setUsername($scope.username);
        } else {
            preferencesService.setUsername("");
            $scope.username = "";
        }
        $scope.password = "";
    });
});

app.controller('DashboardController', function($scope, $location, sessionService, bugzillaService) {

    var credentials = sessionService.getCredentials();
    if (credentials) {
        $scope.username = credentials.username;
    } else {
        // This is only here to setup the username in the template. I think this can go away when signin is in its own page
        $scope.$on("BugzillaLoginSuccess", function (event, args) {
            $scope.username = args.credentials.username;
        });
    }

    $scope.logout = function() {
        bugzillaService.logout();
        $location.path("/").replace();
    };

    $scope.dashboard = undefined;

    $scope.showDashboard = function (what) {
        switch (what) {
        case "websecbugs":
            $location.path("/index.html#!/websecbugs").replace();
            break;
        case "reviews":
            $location.path("/index.html#!/reviews").replace();
            break;
        case "kickoff":
            $location.path("/index.html#!/kickoff").replace();
            break;
        }
        $scope.dashboard = what;
    };
});






app.factory('preferencesService', function () {
    var sharedPreferencesService = {};

    sharedPreferencesService.setUsername = function(username) {
        localStorage.setItem("username", username);
    };

    sharedPreferencesService.getUsername = function() {
        return localStorage.getItem("username");
    };

    return sharedPreferencesService;
});

app.factory('sessionService', function () {
    return {
        setCredentials: function (credentials) {
            sessionStorage.setItem("credentials_username", credentials.username);
            sessionStorage.setItem("credentials_password", credentials.password);
        },
        getCredentials: function () {
            var c = {username: sessionStorage.getItem("credentials_username"), password: sessionStorage.getItem("credentials_password")};
            if (c.username && c.password) {
                return c;
            } else {
                return undefined;
            }
        },
        clearCredentials: function () {
            sessionStorage.removeItem("credentials_username");
            sessionStorage.removeItem("credentials_password");
        }
    };
});

app.factory('bugzillaService', function ($rootScope, $http, sessionService)
{
    var sharedBugzillaService = {};

    sharedBugzillaService.cleanupBug = function(bug) {
        if (bug.creation_time) {
            bug.creation_time = moment(bug.creation_time);
        }

        if (bug.last_change_time) {
            bug.last_change_time = moment(bug.last_change_time);
        }

        if (bug.history) {
            _.each(bug.history, function (event) {
                event.change_time = moment(event.change_time);
            });
        }

        if (!bug.depends_on) {
            bug.depends_on = [];
        }

        // TODO This should move to some utility functions instead
        bug.age = moment().diff(bug.creation_time, 'days'); // Math.floor((Date.now() - bug.creation_time) / (24 * 60 * 60 * 1000));

        bug.ageLabel = "default";
        if (bug.age < 14) {
            bug.ageLabel = "success";
        } else if (bug.age < 28) {
            bug.ageLabel = "warning";
        } else {
            bug.ageLabel = "important";
        }

        bug.isAssigned = function() {
            if (bug.assigned_to) {
                return bug.assigned_to.name !== "nobody@mozilla.org" && bug.assigned_to.name !== "nobody";
            } else {
                return undefined;
            }
        };
    };

    sharedBugzillaService.login = function BugzillaService_login(username, password)
    {
        if (username === "nobody@mozilla.org") {
            sharedBugzillaService.credentials = {username: username, password: password};
            $rootScope.$broadcast("BugzillaLoginSuccess", {credentials:{username:username,password:password}});
            return;
        }

        var params = {
            username: username,
            password: password
        };

        $http({url: "https://api-dev.bugzilla.mozilla.org/latest/bug/38", method:"GET", params:params})
            .success(function(/*data*/) {
                sharedBugzillaService.credentials = {username: username, password: password};
                $rootScope.$broadcast("BugzillaLoginSuccess", {credentials:{username:username,password:password}});
            })
            .error(function(/*data, status, headers, config*/){
                $rootScope.$broadcast("BugzillaLoginFailure");
            });
    };

    sharedBugzillaService.logout = function()
    {
        sharedBugzillaService.credentials = undefined;
        sessionService.clearCredentials();
        $rootScope.$broadcast("BugzillaLogoutSuccess");
    };

    sharedBugzillaService.getUsername = function() {
        return sharedBugzillaService.credentials.username;
    };

    sharedBugzillaService.isAnonymous = function()
    {
        return sharedBugzillaService.credentials && sharedBugzillaService.credentials.username === "nobody@mozilla.org";
    };

    sharedBugzillaService.getBugs = function(options)
    {
        const fieldsThatNeedMultipleParameters = ['product', 'component', 'status', 'resolution'];

        var query = "";

        var appendParameter = function(q, name, value) {
            if (q.length > 0) {
                q += "&";
            }
            return q + encodeURIComponent(name) + "=" + encodeURIComponent(value);
        };

        for (var optionName in options) {
            if (options.hasOwnProperty(optionName)) {
                switch (optionName) {
                    case "advanced": {
                        _.each(options["advanced"], function (t, i) {
                            query = appendParameter(query, "field" + i + "-0-0", t[0]);
                            query = appendParameter(query, "type" + i + "-0-0", t[1]);
                            if (t.length == 3) {
                                query = appendParameter(query, "value" + i + "-0-0", t[2]);
                            }
                        });
                        break;
                    }
                    default: {
                        if (options[optionName] instanceof Array) {
                            if (fieldsThatNeedMultipleParameters.indexOf(optionName) != -1) {
                                _.each(options[optionName], function (value) {
                                    query = appendParameter(query, optionName, value);
                                });
                            } else {
                                query = appendParameter(query, optionName, options[optionName].join(','));
                            }
                        } else {
                            query = appendParameter(query, optionName, options[optionName]);
                        }
                    }
                }
            }
        }

        if (options.credentials && options.credentials.username !== "nobody@mozilla.org") {
            query = appendParameter(query, "username", options.credentials.username);
            query = appendParameter(query, "password", options.credentials.password);
        }

        return $http({url: "https://api-dev.bugzilla.mozilla.org/latest/bug?" + query, method:"GET"});
    };

    sharedBugzillaService.isLoggedIn = function() {
        return this.credentials != undefined;
    };

    return sharedBugzillaService;
});

app.filter('moment', function () {
    return function(input, format) {
        return moment(input).format(format);
    };
});





// These can go away

app.controller('IndexController', function() {
});

app.controller('OneController', function() {
});

app.controller('TwoController', function() {
});
