var app = angular.module('drillApp', ['ngRoute','ui.bootstrap', 'LocalStorageModule']);
app.uid = function() {
    return ("0000" + (Math.random()*Math.pow(36,4) << 0).toString(36)).slice(-4);
};
app.toJsonString = function (obj) {
    if (obj == null)
        return null;
    else if (typeof  obj === 'object')
        return JSON.stringify(obj);
    else
        return obj.toString();
};
app.fromJsonString = function (obj) {
    if (obj == null)
        return null;
    else if (typeof obj === 'string')
        return JSON.parse(obj);
    else
        return obj;
};

app.config(function($routeProvider){
    $routeProvider.
        when('/', {redirectTo: '/drills'}).
        when('/drills', {templateUrl: 'drillList.html', controller: 'drillListController'}).
        when('/edit/:id?', {templateUrl: 'drillEdit.html', controller: 'drillEditController'}).
        when('/drill/:id', {templateUrl: 'drillView.html', controller: 'drillViewController'}).
        when('/score/:id', {templateUrl: 'score.html', controller: 'scoreController'}).
        when('/history/:id', {templateUrl: 'history.html', controller: 'scoreController'}).
        when('/rawdata/:export?', {templateUrl: 'rawdata.html', controller: 'rawDataController'}).
        otherwise({redirectTo: '/'});
});

app.factory('drillsService', function (localStorageService) {
    var service = {
        drills: null,
        load: function() {
            this.drills = localStorageService.get('drills');
            if (this.drills == null)
                this.drills = [];
        },
        find: function(id) {
            for (var i=0; i<this.drills.length; i++) {
                if (this.drills[i].id == id) {
                    return i;
                }
            }
            return -1;
        },
        getDrill: function(id) {
            var idx = this.find(id);
            return (idx < 0) ? null : this.drills[idx];
        },
        getNewDrill: function() {
            return (this.newDrill) ? this.newDrill : {level: 1, history: []};
        },
        add: function(drill) {
            this.drills.push(drill);
        },
        remove: function(drill) {
            var idx = this.find(drill.id);
            if (idx >= 0)
                this.drills.splice(idx, 1);
        },
        removeAll: function() {
            this.drills = [];
        },
        save: function() {
            localStorageService.set('drills', this.drills);
        }
    };
    service.load();
    return service;
});


app.controller('drillListController', function ($scope, $location, drillsService) {
    var drills = drillsService.drills;
    var groups = {};
    drills.forEach(function (drill) {
        groups[drill.group] = null;
    });
    $scope.groups = Object.keys(groups);

    $scope.getCategories = function (group) {
        if (group) {
            var c = {};
            drills.forEach(function (drill) {
                if (drill.group == group) c[drill.category] = null;
            });
            return Object.keys(c);
        }
    };

    $scope.load = function() {
        if (!$scope.sGroup) {
            $scope.drills = drills;
        } else {
            var result = [];
            drills.forEach(function (drill) {
                if (drill.group == $scope.sGroup) {
                    if (!$scope.sCategory || drill.category == $scope.sCategory) {
                        result.push(drill);
                    }
                }
            });
            $scope.drills = result;
        }
    };

    $scope.newDrill = function () {
        drillsService.newDrill = {group: $scope.sGroup, category: $scope.sCategory, level: 1, history: []};
        $location.path('/edit');
    };
    $scope.raw = function() {
        $location.path('/rawdata');
    };

});

app.controller('drillViewController', function ($scope, $routeParams, $location, drillsService) {
    var drillId = $routeParams.id;
    $scope.drill = drillsService.getDrill(drillId);
    $scope.stats = {last:0, high:0, low:999999, avg:0};
    var sum = 0, cnt = 0;
    $scope.drill.history = ($scope.drill.history) ? $scope.drill.history : [];
    $scope.drill.history.forEach(function (hElem) {
        var score = hElem.score / hElem.attempts;
        $scope.stats.last = score;
        $scope.stats.high = Math.max($scope.stats.high, score);
        $scope.stats.low = Math.min($scope.stats.low, score);
        sum += score;
        cnt++;
    });
    $scope.stats.avg = sum / cnt;

    $scope.edit = function() {
        $location.path('/edit/' + drillId);
    };
    $scope.score = function () {
        $location.path('/score/' + drillId);
    };
    $scope.history = function () {
        $location.path('/history/' + drillId);
    };

});

app.controller('drillEditController', function ($scope, $routeParams, $location, drillsService) {
    var drillId = $routeParams.id;
    if (drillId) {
        $scope.drill = drillsService.getDrill(drillId);
    } else {
        $scope.drill = drillsService.getNewDrill();
    }
    $scope.save = function() {
        if (!$scope.drill.id) {
            $scope.drill.id = app.uid();
            drillsService.add($scope.drill);
        }
        drillsService.save();
        $location.path('/drill/' + $scope.drill.id);
    };
    $scope.remove = function() {
        drillsService.remove($scope.drill);
        drillsService.save();
        $location.path('/drills');
    };
});

app.controller('scoreController', function ($scope, $routeParams, $location, drillsService) {
    var drillId = $routeParams.id;
    $scope.drill = drillsService.getDrill(drillId);
    $scope.attempts = 1;
    $scope.save = function() {
        $scope.drill.history.push({date: new Date(), attempts: $scope.attempts, score: $scope.score});
        drillsService.save();
        $location.path('/drill/' + drillId);
    };

    $scope.cancel = function () {
        $location.path('/drill/' + drillId);
    };

    $scope.deleteHistory = function(historyItem) {
        var idx = $scope.drill.history.indexOf(historyItem);
        if (idx >= 0) {
            $scope.drill.history.splice(idx, 1);
            drillsService.save();
        }
    };
});

app.controller('rawDataController', function ($scope, $routeParams, $location, drillsService) {
    if ($routeParams.export) {
        $scope.rawdata = app.toJsonString(drillsService.drills);
        $scope.exporting = true;
    }

    $scope.deleteAll = function() {
        if (confirm("Delete All Data?")) {
            drillsService.removeAll();
            drillsService.save();
        }
    };

    $scope.importData = function () {
        var data = app.fromJsonString($scope.rawdata);
        if (!Array.isArray(data)) {
            alert("Invalid data");
            return;
        }
        for (var i=0; i<data.length; i++) {
            var drill = data[i];
            if (!drill.name || !drill.group) {
                alert("Invalid data");
                return;
            }
            drillsService.add(drill);
        }
        drillsService.save();
        $location.path('/');
    };
});