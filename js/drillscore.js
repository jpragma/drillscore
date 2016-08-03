var app = angular.module('drillApp', ['ngRoute','ui.bootstrap', 'LocalStorageModule', 'ngTagsInput']);
app.uid = function() {
    return ("0000" + (Math.random()*Math.pow(36,4) << 0).toString(36)).slice(-4);
};
app.removeProp = function(obj, name) {
    for (prop in obj) {
        if (prop === name)
            delete obj[prop];
        else if (typeof obj[prop] === 'object')
            app.removeProp(obj[prop], name);
    }
}
app.toJsonString = function (obj) {
    if (obj == null) {
        return null;
    } else if (typeof  obj === 'object') {
        app.removeProp(obj, '$$hashKey');
        return JSON.stringify(obj);
    } else {
        return obj.toString();
    }
};
app.fromJsonString = function (obj) {
    if (obj == null)
        return null;
    else if (typeof obj === 'string')
        return JSON.parse(obj);
    else
        return obj;
};
app.directive('selectOnClink', ['$window', function ($window) {
    return {
        restrict: 'A',
        link: function (scope, element, attrs) {
            element.on('click', function () {
                if (!$window.getSelection().toString())
                    this.setSelectionRange(0, this.value.length);
            });
        }
    }
}]);

app.config(function($routeProvider){
    $routeProvider.
        when('/', {redirectTo: '/drills'}).
        when('/drills', {templateUrl: 'drillList.html', controller: 'drillListController'}).
        when('/edit/:id?', {templateUrl: 'drillEdit.html', controller: 'drillEditController'}).
        when('/drill/:id', {templateUrl: 'drillView.html', controller: 'drillViewController'}).
        when('/score/:id/:idx?', {templateUrl: 'score.html', controller: 'scoreController'}).
        when('/history/:id', {templateUrl: 'history.html', controller: 'scoreController'}).
        when('/rawdata/:export?', {templateUrl: 'rawdata.html', controller: 'rawDataController'}).
        when('/settings', {templateUrl: 'settings.html', controller: 'settingsController'}).
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

app.factory('settingsService', function (localStorageService) {
    var service = {
        load: function() {
            this.settings = localStorageService.get('settings');
            if (this.settings == null) {
                this.settings = {
                    diagramUrlPattern: 'https://pad.chalkysticks.com/image',
                    showInList: false,
                    showInView: true
                }
            }
        },
        save: function() {
            localStorageService.set('settings', this.settings);
        }
    }
    service.load();
    return service;
});

app.controller('drillListController', function ($scope, $location, drillsService, settingsService) {
    var drills = drillsService.drills;
    $scope.settings = settingsService.settings;
    if (drillsService.selectedGroup) {
        $scope.sGroup = drillsService.selectedGroup;
    }
    if (drillsService.selectedTag) {
        $scope.sTag = drillsService.selectedTag;
    }

    var groups = {};
    var tags={};
    drills.forEach(function (drill) {
        groups[drill.group] = null;
        if (drill.tags) {
            drill.tags.forEach(function (tag) {
                tags[tag.text] = null;
            });
        }
    });
    $scope.groups = Object.keys(groups);
    $scope.tags = Object.keys(tags);


    $scope.load = function() {
        if (!$scope.sGroup && !$scope.sTag) {
            $scope.drills = drills;
        } else {
            var result = [];
            drills.forEach(function (drill) {
                if (!$scope.sGroup || drill.group == $scope.sGroup) {
                    if (!$scope.sTag) {
                        result.push(drill);
                    } else if (drill.tags) {
                        var added = false;
                        drill.tags.forEach(function (tag) {
                            if (tag.text == $scope.sTag && !added) {
                                result.push(drill);
                                added = true;
                            }
                        });
                    }
                }
            });
            $scope.drills = result;
            drillsService.selectedGroup = $scope.sGroup;
            drillsService.selectedTag = $scope.sTag;
        }
    };

    $scope.newDrill = function () {
        drillsService.newDrill = {group: $scope.sGroup, level: 1, history: []};
        $location.path('/edit');
    };
    $scope.raw = function() {
        $location.path('/rawdata');
    };
    $scope.load();

});

app.controller('drillViewController', function ($scope, $routeParams, $location, drillsService, settingsService) {
    var drillId = $routeParams.id;
    $scope.settings = settingsService.settings;
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

    $scope.backToList = function() {
        $location.path('/drills');
    };
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
        $scope.backToDrillView();
    };
    $scope.backToDrillView = function() {
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
    var historyIdx = $routeParams.idx;
    $scope.drill = drillsService.getDrill(drillId);
    if (historyIdx) {
        $scope.historyEntry = $scope.drill.history[historyIdx];
    } else {
        $scope.historyEntry = {date: new Date(), table: 7, attempts: 1};
    }
    $scope.attempts = 1;
    $scope.save = function() {
        if (historyIdx) {
            $scope.drill.history[historyIdx] = $scope.historyEntry;
        } else {
            $scope.drill.history.push($scope.historyEntry);
        }
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
    $scope.rawdata = app.toJsonString(drillsService.drills);

    $scope.deleteAll = function() {
        if (confirm("Delete All Data?")) {
            drillsService.removeAll();
            drillsService.save();
            $location.path('/');
        }
    };

    $scope.importData = function () {
        var backup = drillsService.drills;
        try {
            var data = app.fromJsonString($scope.rawdata);
        } catch (e) {
            alert("Error parsing data " + e.message);
            return;
        }

        if (!Array.isArray(data)) {
            alert("Invalid data");
            return;
        }
        drillsService.removeAll();
        for (var i=0; i<data.length; i++) {
            var drill = data[i];
            if (!drill.name || !drill.group) {
                alert("Invalid data");
                drillsService.drills = backup;
                return;
            }
            drillsService.add(drill);
        }
        drillsService.save();
        $location.path('/');
    };
});

app.controller('settingsController', function ($scope, $location, settingsService, drillsService) {
    $scope.settings = settingsService.settings;
    $scope.save = function () {
        settingsService.settings = $scope.settings;
        settingsService.save();
        $location.path('/');
    };
    $scope.preloadImages = function() {
        if (!$scope.imageCache) {
            $scope.imageCache = [];
        }  
        var img;
        drillsService.drills.forEach(function (drill) {
            if (drill.diagram) {
                img = new Image();
                img.onload = function() {
                    var index = $scope.imageCache.indexOf(this);
                    if (index !== -1) {
                        $scope.imageCache.splice(index, 1);
                    }
                }
                img.src = $scope.settings.diagramUrlPattern + "/" + drill.diagram;
                $scope.imageCache.push(img);                
            }
        });
        alert('Requested ' + $scope.imageCache.length + ' images');
    };
});
