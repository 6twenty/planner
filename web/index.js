'use strict';

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// Drives the app

var App = function () {
  function App() {
    _classCallCheck(this, App);

    this.el = document.body;
    this.editing = false;
    this._filtered = '';

    if (navigator.standalone) {
      this.el.classList.add('standalone');
    }

    var colorHash = new ColorHash({ lightness: [0.8, 0.85, 0.9], saturation: [0.8, 0.9, 1] });

    App.hsl = function (string) {
      var hsl = colorHash.hsl(string);

      // Avoid hues in the blue range
      if (hsl[0] > 200 && hsl[0] < 280) {
        hsl = App.hsl(string + '_');
      }

      return hsl;
    };

    App.canDrag = true;

    this.hammer();
    this.build();
    this.observe();

    this.list = new List({
      app: this
    }).build();

    this.list.render();

    this.loading();
    this.firebase().then(this.init.bind(this));
  }

  _createClass(App, [{
    key: 'firebase',
    value: function (_firebase) {
      function firebase() {
        return _firebase.apply(this, arguments);
      }

      firebase.toString = function () {
        return _firebase.toString();
      };

      return firebase;
    }(function () {
      var anHourAgo = moment().subtract(1, 'hour');
      var awaitingAuthRedirect = sessionStorage.getItem('awaitingAuthRedirect');

      var isAwaitingAuthRedirect = false;
      if (awaitingAuthRedirect) {
        isAwaitingAuthRedirect = moment(awaitingAuthRedirect).isAfter(anHourAgo);
        sessionStorage.removeItem('awaitingAuthRedirect');
      }

      firebase.initializeApp(this.config);

      this.db = firebase.database();

      return new Promise(function (resolve, reject) {

        firebase.auth().onAuthStateChanged(function (user) {
          if (user || !isAwaitingAuthRedirect) {
            resolve();
          } else {
            firebase.auth().getRedirectResult().then(resolve).catch(function (error) {
              resolve(); // TODO - show a notice?
            });
          }
        });
      });
    })
  }, {
    key: 'signIn',
    value: function signIn(provider) {
      this.modal.dataset.active = '#loading';
      sessionStorage.setItem('awaitingAuthRedirect', moment().format());
      var authProvider = new firebase.auth[provider]();
      firebase.auth().signInWithRedirect(authProvider);
    }
  }, {
    key: 'signOut',
    value: function signOut() {
      firebase.auth().signOut();
      this.list.unload();

      var settings = this.el.querySelector('.settings');
      var profile = this.el.querySelector('.profile');

      settings.innerText = '';
      profile.innerText = '';

      settings.removeAttribute('style');
      profile.removeAttribute('style');

      this.modal.dataset.active = '#providers';
    }
  }, {
    key: 'loading',
    value: function loading() {
      this.modal.dataset.active = '#loading';
    }
  }, {
    key: 'init',
    value: function init() {
      var user = firebase.auth().currentUser;

      if (user) {
        this.modal.dataset.active = '';

        var settings = this.el.querySelector('.settings');
        var profile = this.el.querySelector('.profile');
        var letter = user.displayName ? user.displayName[0] : '?';

        settings.innerText = letter;
        profile.innerText = letter;

        if (user.photoURL) {
          settings.style.backgroundImage = 'url(' + user.photoURL + ')';
          profile.style.backgroundImage = 'url(' + user.photoURL + ')';
        }

        this.list.load();
      } else {
        this.modal.dataset.active = '#providers';
      }
    }
  }, {
    key: 'load',
    value: function load(items) {
      var json = JSON.stringify(items);
      localStorage.setItem('items', json);
      this.list.load();
    }
  }, {
    key: 'build',
    value: function build() {
      this.buildAside();
      this.buildModal();
    }
  }, {
    key: 'buildAside',
    value: function buildAside() {
      this.aside = document.createElement('aside');

      this.el.appendChild(this.aside);
    }
  }, {
    key: 'buildModal',
    value: function buildModal() {
      this.modal = document.createElement('div');
      this.modal.classList.add('modal');

      // this.modal.dataset.active = '#providers'

      this.buildModalLoading();
      this.buildModalProviders();
      this.buildModalSettings();

      this.el.appendChild(this.modal);
    }
  }, {
    key: 'buildModalLoading',
    value: function buildModalLoading() {
      var section = document.createElement('section');
      var div = document.createElement('div');

      section.dataset.id = 'loading';
      div.classList.add('loading');
      section.appendChild(div);

      this.modal.appendChild(section);
    }
  }, {
    key: 'buildModalProviders',
    value: function buildModalProviders() {
      var _this = this;

      var section = document.createElement('section');

      section.dataset.id = 'providers';

      var a = document.createElement('a');
      var img = document.createElement('img');
      img.src = '/google.svg';
      a.classList.add('provider');
      a.appendChild(img);
      section.appendChild(a);

      a.addEventListener('singletap', function (e) {
        _this.signIn('GoogleAuthProvider');
      });

      this.modal.appendChild(section);
    }
  }, {
    key: 'buildModalSettings',
    value: function buildModalSettings() {
      var _this2 = this;

      var section = document.createElement('section');
      var close = document.createElement('a');
      var profile = document.createElement('div');
      var signOut = document.createElement('button');

      close.classList.add('close');
      profile.classList.add('profile');
      signOut.innerText = 'Sign out';
      section.dataset.id = 'settings';
      section.appendChild(close);
      section.appendChild(profile);
      section.appendChild(signOut);

      close.addEventListener('singletap', function (e) {
        _this2.list.app.modal.dataset.active = '';
      });

      signOut.addEventListener('singletap', function (e) {
        _this2.signOut();
      });

      this.modal.appendChild(section);
    }
  }, {
    key: 'renderInlineSVG',
    value: function renderInlineSVG(path, viewbox) {
      return '\n      <svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="' + viewbox + '" class="svg-path">\n        <path d="' + path + '">\n      </svg>\n    ';
    }
  }, {
    key: 'hammer',
    value: function hammer() {
      this.hammer = new Hammer.Manager(this.el, { domEvents: true });

      var singleTap = new Hammer.Tap({ event: 'singletap', taps: 1 });
      var doubleTap = new Hammer.Tap({ event: 'doubletap', taps: 2 });

      this.hammer.add(doubleTap);
      this.hammer.add(singleTap);
    }
  }, {
    key: 'observe',
    value: function observe() {
      var _this3 = this;

      // For regular keys, use `keypress` (provides the correct char code)
      window.addEventListener('keypress', function (e) {
        if (_this3.editing) return;
        if (e.metaKey) return;
        if (e.ctrlKey) return;
        if (e.altKey) return;
        if (e.which === 13) return;

        var char = String.fromCharCode(e.which);

        if (!char) return;

        _this3.filtered += char;
      });

      // For special keys (esc and backspace), use `keydown`
      window.addEventListener('keydown', function (e) {
        if (_this3.editing) return;
        if (e.metaKey) return;
        if (e.ctrlKey) return;
        if (e.altKey) return;
        if (e.shiftKey) return;

        if (e.which === 27) {
          // Esc
          e.preventDefault();

          if (_this3.modal.dataset.active === '#settings') {
            _this3.modal.dataset.active = '';
          }

          if (document.activeElement) {
            document.activeElement.blur();
          }

          _this3.filtered = '';
          if (_this3.list.drake.dragging) {
            _this3.list.drake.cancel(true);
            if (_this3.list.originalSectionId) {
              _this3.list.el.dataset.active = '#' + _this3.list.originalSectionId;
            }
          }
        }

        if (e.which === 8) {
          // Backspace
          e.preventDefault();
          _this3.filtered = _this3.filtered.slice(0, _this3.filtered.length - 1);
        }
      });
    }
  }, {
    key: 'env',
    get: function get() {
      if (this._env) return this._env;

      this._env = 'dev';

      if (location.hostname === 'planner-6059a.firebaseapp.com') {
        this._env = 'prod';
      }

      return this._env;
    }
  }, {
    key: 'config',
    get: function get() {
      if (this._config) return this._config;

      var configs = {
        dev: {
          apiKey: "AIzaSyAqvyzUD5ioSwBSkj1zd61a_LipptjQb0M",
          authDomain: "planner-dev-73d1e.firebaseapp.com",
          databaseURL: "https://planner-dev-73d1e.firebaseio.com",
          storageBucket: ""
        },

        prod: {
          apiKey: "AIzaSyBgNTLh6iZ8itiE0-JaJJqlyUJ4aW4rB3c",
          authDomain: "planner-6059a.firebaseapp.com",
          databaseURL: "https://planner-6059a.firebaseio.com",
          storageBucket: ""
        }
      };

      this._config = configs[this.env];

      return this._config;
    }
  }, {
    key: 'filtered',
    get: function get() {
      return this._filtered;
    },
    set: function set(value) {
      this._filtered = value;
      this.aside.innerText = value;
      this.list.filter();
    }
  }], [{
    key: 'uniqueId',
    value: function uniqueId() {
      this._counter = this._counter || 0;
      return ++this._counter;
    }
  }, {
    key: 'escapeRegex',
    value: function escapeRegex(string) {
      return string.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    }
  }, {
    key: 'markdown',
    value: function markdown(string) {
      string = string.replace(/(^|\s)(#(\w+))\b/g, function (match, initial, hashtag) {
        var hsl = App.hsl(hashtag.replace('#', ''));
        var color = 'hsl(' + hsl[0] + ', ' + hsl[1] * 100 + '%, ' + hsl[2] * 100 + '%)';
        return initial + '<span style="color:' + color + '">' + hashtag + '</span>';
      });

      var isWithinCodeBlock = false;
      var array = string.split('');
      string = array.map(function (char, i) {
        var lastChar = array[i - 1];
        var nextChar = array[i + 1];

        if (isWithinCodeBlock) {
          if (char === '`' && lastChar !== '`') {
            isWithinCodeBlock = false;
          }
        } else {
          if (char === '`' && lastChar !== '`') {
            isWithinCodeBlock = true;
          } else if (char === '-' && nextChar === '-') {
            return '';
          } else if (char === '-' && lastChar === '-') {
            return '—';
          }
        }

        return char;
      }).join('');

      return marked(string);
    }

    // Examples:
    // - January 12 - 19
    // - January 12 - February 3

  }, {
    key: 'formatWeekRange',
    value: function formatWeekRange(range) {
      var today = moment();
      var fromFormat = 'MMMM D';
      var toFormat = 'MMMM D';

      if (range.from.month() === range.to.month()) {
        toFormat = 'D';
      }

      var fromDate = range.from.format(fromFormat);
      var toDate = range.to.format(toFormat);

      return fromDate + ' - ' + toDate;
    }
  }]);

  return App;
}();

// Can have multiple lists, but only one is active
// Lists hold all the items within


var List = function () {
  function List(opts) {
    _classCallCheck(this, List);

    if (opts.name) this.name = opts.name;
    this.app = opts.app;
    this.el = document.createElement('main');
    this.items = {};
  }

  _createClass(List, [{
    key: 'build',
    value: function build() {
      var _this4 = this;

      this.sections = []; // Ordered, for rendering sequentially
      this.sectionById = {}; // For easy lookup

      var date = moment().startOf('day').subtract(1, 'day');
      var days = ['today', 'tomorrow', 'day-after-tomorrow'];

      // Sundays are skipped, so if today is Sunday, pretend it's Saturday
      if (moment().day() === 0) date.subtract(1, 'day');

      this.el.dataset.active = '';

      days.forEach(function (day) {
        date.add(1, 'days');

        if (date.day() === 0) {
          // Skip Sundays
          date.add(1, 'days');
        }

        var section = new DaySection({
          list: _this4,
          date: date,
          sectionId: day
        }).build();

        section.render(_this4.el);

        _this4.sections.push(section);
        _this4.sectionById[section.id] = section;
      });

      var sectionClasses = [WeekSection, MonthSection, BacklogSection, OverdueSection, DoneSection];

      sectionClasses.forEach(function (SectionClass) {
        var section = new SectionClass({
          list: _this4
        }).build();

        section.render(_this4.el);

        _this4.sections.push(section);
        _this4.sectionById[section.id] = section;
      });

      this.dragula();

      return this;
    }
  }, {
    key: 'dragula',
    value: function (_dragula) {
      function dragula() {
        return _dragula.apply(this, arguments);
      }

      dragula.toString = function () {
        return _dragula.toString();
      };

      return dragula;
    }(function () {
      var _this5 = this;

      var lists = this.sections.map(function (section) {
        return section.listEl;
      });
      var headers = this.sections.map(function (section) {
        return section.header;
      });
      var els = [].concat(_toConsumableArray(lists), _toConsumableArray(headers));

      this.drake = dragula({
        containers: els,
        mirrorContainer: this.el,
        moves: function moves(el, source, handle, sibling) {
          if (source.nodeName === 'HEADER') {
            return false;
          }

          if (!App.canDrag) {
            return false;
          }

          var item = _this5.items[el.dataset.id];

          if (item.editing) {
            return false;
          }

          return true;
        },
        accepts: function accepts(el, target, source, sibling) {
          var section = _this5.sectionById[target.parentElement.dataset.id];
          var active = section.list.el.querySelector('section.over');

          if (active) {
            active.classList.remove('over');
          }

          section.el.classList.add('over');
          _this5.el.dataset.active = '#' + section.sectionId;

          if (target.nodeName === 'HEADER') {
            if (target.parentElement === el.parentElement.parentElement) {
              return false;
            }

            section.listEl.insertBefore(el, section.listEl.firstChild);

            return false;
          }

          return true;
        }
      });

      this.drake.on('drag', function (el) {
        _this5.originalSectionId = el.parentElement.parentElement.dataset.sectionId;
        el.parentElement.parentElement.classList.add('over');
      });

      this.drake.on('dragend', function (el) {
        var active = _this5.el.querySelector('section.over');

        if (active) {
          active.classList.remove('over');
        }
      });

      this.drake.on('drop', function (el, target, source, sibling) {
        var item = _this5.items[el.dataset.id];
        var section = _this5.sectionById[target.parentElement.dataset.id];
        item.section = section;
      });

      this.drake.on('cloned', function (clone, original, type) {
        var color = getComputedStyle(original).backgroundColor;
        clone.style.boxShadow = 'inset 0 0 0 50vw ' + color;
      });

      this.drake.on('shadow', function (el, container, source) {
        var mirror = _this5.el.querySelector('.item.gu-mirror');
        mirror.dataset.sectionType = container.parentElement.dataset.name;
      });
    })
  }, {
    key: 'load',
    value: function load() {
      var _this6 = this;

      var items = this.stored();

      if (!items) return;

      items.forEach(function (item) {
        var section = _this6.sectionById[item.group];

        if (!section) {
          section = _this6.sectionById.overdue;
        }

        section.createItem({
          content: item.content
        });
      });
    }
  }, {
    key: 'unload',
    value: function unload() {
      var _this7 = this;

      var ids = Object.keys(this.items);

      ids.forEach(function (id) {
        var item = _this7.items[id];

        item.detach();

        delete _this7.items[id];
      });
    }
  }, {
    key: 'stored',
    value: function stored() {
      if (this._stored) {
        return this._stored;
      }

      var stored = localStorage.getItem('items');
      if (!stored) return;

      var items = JSON.parse(stored);

      // If `items` is a key/value object it needs to be converted to a simple array
      if (!Array.isArray(items)) {
        items = Object.keys(items).map(function (id) {
          return items[id];
        });
      }

      this._stored = items;

      return items;
    }
  }, {
    key: 'render',
    value: function render() {
      this.app.el.appendChild(this.el);
    }
  }, {
    key: 'save',
    value: function save() {
      var _this8 = this;

      // Get order from the DOM
      var els = this.el.querySelectorAll('.item:not(.gu-mirror)');
      var ids = [].concat(_toConsumableArray(els)).map(function (el) {
        return el.dataset.id;
      });
      var items = ids.map(function (id) {
        return _this8.items[id];
      });
      var stringified = JSON.stringify(items);

      this._stored = null;
      localStorage.setItem('items', stringified);
    }
  }, {
    key: 'filter',
    value: function filter() {
      var _this9 = this;

      var regex = new RegExp(App.escapeRegex(this.app.filtered), 'i');

      Object.keys(this.items).forEach(function (id) {
        var item = _this9.items[id];

        if (regex.test(item.content)) {
          item.show();
        } else {
          item.hide();
        }
      });
    }
  }]);

  return List;
}();

// Represents a visual group, and is where items get rendered


var Section = function () {
  function Section(opts) {
    _classCallCheck(this, Section);

    this.id = opts.id || opts.name;
    this.list = opts.list;
    this.name = opts.name;
    this.title = opts.name;
    this.sectionId = opts.sectionId;
    this.classes = new Set();
    this.classes.add(opts.name);
    this.classes.add(opts.sectionId);
  }

  _createClass(Section, [{
    key: 'build',
    value: function build() {
      var _this10 = this;

      var section = document.createElement('section');
      var header = document.createElement('header');
      var back = document.createElement('button');
      var list = document.createElement('div');
      section.appendChild(header);
      section.appendChild(list);

      section.dataset.id = this.id;
      section.dataset.name = this.name;
      section.dataset.sectionId = this.sectionId;
      this.classes.forEach(function (className) {
        section.classList.add(className);
      });

      var emoji = this.emoji();
      if (emoji) header.dataset.emoji = emoji;
      header.innerText = this.title;
      back.classList.add('back');
      list.classList.add('list');
      header.appendChild(back);

      this.el = section;
      this.header = header;
      this.listEl = list;

      this.el.addEventListener('doubletap', function (e) {
        if (e.target !== _this10.listEl && e.target !== _this10.header) return;

        var first = e.target !== _this10.listEl;

        _this10.createItem({
          edit: true,
          first: first
        });
      });

      header.addEventListener('singletap', function (e) {
        if (e.target !== header) return;

        _this10.list.el.dataset.active = '#' + _this10.sectionId;
      });

      back.addEventListener('singletap', function (e) {
        if (e.target !== back) return;

        _this10.list.el.dataset.active = '';
      });

      return this;
    }
  }, {
    key: 'emoji',
    value: function emoji() {}
  }, {
    key: 'render',
    value: function render(parent) {
      parent.appendChild(this.el);
    }
  }, {
    key: 'createItem',
    value: function createItem(opts) {
      opts.section = this;
      opts.persisted = false;

      var item = new Item(opts).build();

      item.render({ first: opts.first });

      this.list.items[item.id] = item;
    }
  }]);

  return Section;
}();

var DaySection = function (_Section) {
  _inherits(DaySection, _Section);

  function DaySection(opts) {
    _classCallCheck(this, DaySection);

    var date = opts.date;
    var today = moment().startOf('day');

    if (today.day() === 0) {
      today.subtract(1, 'day');
    }

    var isToday = date.isSame(today);
    var isSaturday = date.day() === 6;

    opts.id = date.format('YYYY-MM-DD');
    opts.name = 'day';

    var _this11 = _possibleConstructorReturn(this, Object.getPrototypeOf(DaySection).call(this, opts));

    _this11.date = date;
    _this11.title = date.format('dddd');

    if (isSaturday) {
      _this11.classes.add('weekend');
    }

    if (isToday && isSaturday) {
      _this11.title = 'This weekend';
    } else if (isToday) {
      _this11.title = 'Today';
    } else if (isSaturday) {
      _this11.title = 'Weekend';
    }
    return _this11;
  }

  _createClass(DaySection, [{
    key: 'build',
    value: function build() {
      var _this12 = this;

      _get(Object.getPrototypeOf(DaySection.prototype), 'build', this).call(this);

      var today = moment().startOf('day');
      var day = this.date.format('dddd');

      if (today.day() === 0) {
        today.subtract(1, 'day');
      }

      if (this.date.isSame(today)) {
        day = 'today';
      }

      if (this.date.day() === 6) {
        day = 'the weekend';
      }

      this.listEl.dataset.day = day;

      if (this.date.isSame(today)) {
        var settings = document.createElement('a');

        settings.classList.add('settings');

        settings.addEventListener('singletap', function (e) {
          _this12.list.app.modal.dataset.active = '#settings';
        });

        this.header.appendChild(settings);
      }

      return this;
    }
  }]);

  return DaySection;
}(Section);

var WeekSection = function (_Section2) {
  _inherits(WeekSection, _Section2);

  function WeekSection(opts) {
    _classCallCheck(this, WeekSection);

    var dateStart = moment().startOf('week');
    var dateEnd = moment().endOf('week');

    opts.id = dateStart.format('YYYY-MM-DD') + '-' + dateEnd.format('YYYY-MM-DD');
    opts.name = 'week';
    opts.sectionId = 'week';

    var _this13 = _possibleConstructorReturn(this, Object.getPrototypeOf(WeekSection).call(this, opts));

    _this13.title = 'This week';
    return _this13;
  }

  _createClass(WeekSection, [{
    key: 'build',
    value: function build() {
      var dateStart = moment().startOf('week');
      var dateEnd = moment().endOf('week');

      _get(Object.getPrototypeOf(WeekSection.prototype), 'build', this).call(this);

      this.listEl.dataset.dates = App.formatWeekRange({ from: dateStart, to: dateEnd });

      return this;
    }
  }]);

  return WeekSection;
}(Section);

var MonthSection = function (_Section3) {
  _inherits(MonthSection, _Section3);

  function MonthSection(opts) {
    _classCallCheck(this, MonthSection);

    var dateStart = moment().startOf('month');
    var dateEnd = moment().endOf('month');

    opts.id = dateStart.format('YYYY-MM-DD') + '-' + dateEnd.format('YYYY-MM-DD');
    opts.name = 'month';
    opts.sectionId = 'month';

    var _this14 = _possibleConstructorReturn(this, Object.getPrototypeOf(MonthSection).call(this, opts));

    _this14.title = 'This month';
    return _this14;
  }

  _createClass(MonthSection, [{
    key: 'build',
    value: function build() {
      var date = moment();

      _get(Object.getPrototypeOf(MonthSection.prototype), 'build', this).call(this);

      this.listEl.dataset.date = date.format('MMMM');

      return this;
    }
  }]);

  return MonthSection;
}(Section);

var DoneSection = function (_Section4) {
  _inherits(DoneSection, _Section4);

  function DoneSection(opts) {
    _classCallCheck(this, DoneSection);

    opts.name = 'done';
    opts.sectionId = 'done';
    return _possibleConstructorReturn(this, Object.getPrototypeOf(DoneSection).call(this, opts));
  }

  _createClass(DoneSection, [{
    key: 'emoji',
    value: function emoji() {
      return '😍';
    }
  }, {
    key: 'build',
    value: function build() {
      var _this16 = this;

      _get(Object.getPrototypeOf(DoneSection.prototype), 'build', this).call(this);

      var button = document.createElement('button');

      button.classList.add('clear');
      button.innerText = 'Clear';
      this.el.appendChild(button);

      button.addEventListener('singletap', function (e) {
        _this16.clear();
      });

      return this;
    }
  }, {
    key: 'clear',
    value: function clear() {
      var _this17 = this;

      Object.keys(this.list.items).forEach(function (id) {
        var item = _this17.list.items[id];
        if (item.section.id === _this17.id) {
          item.remove();
        }
      });
    }
  }]);

  return DoneSection;
}(Section);

var OverdueSection = function (_Section5) {
  _inherits(OverdueSection, _Section5);

  function OverdueSection(opts) {
    _classCallCheck(this, OverdueSection);

    opts.name = 'overdue';
    opts.sectionId = 'overdue';
    return _possibleConstructorReturn(this, Object.getPrototypeOf(OverdueSection).call(this, opts));
  }

  _createClass(OverdueSection, [{
    key: 'emoji',
    value: function emoji() {
      return '😰';
    }
  }]);

  return OverdueSection;
}(Section);

var BacklogSection = function (_Section6) {
  _inherits(BacklogSection, _Section6);

  function BacklogSection(opts) {
    _classCallCheck(this, BacklogSection);

    opts.name = 'backlog';
    opts.sectionId = 'backlog';
    return _possibleConstructorReturn(this, Object.getPrototypeOf(BacklogSection).call(this, opts));
  }

  return BacklogSection;
}(Section);

// Items have an ID (not persisted) and text content and belong to a section


var Item = function () {
  function Item(opts) {
    _classCallCheck(this, Item);

    this.id = App.uniqueId();
    this._editing = !!opts.edit;
    this._section = opts.section;
    this._content = opts.content || '';
    this.list = this._section.list;
    this.persisted = opts.persisted;

    // Explicit bindings
    this.onDblClick = this.onDblClick.bind(this);
    this.onKeydown = this.onKeydown.bind(this);
    this.onBlur = this.onBlur.bind(this);
    this.onPaste = this.onPaste.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
  }

  _createClass(Item, [{
    key: 'toJSON',
    value: function toJSON() {
      return {
        group: this.section.id,
        content: this.content
      };
    }
  }, {
    key: 'build',
    value: function build() {
      var el = document.createElement('article');

      el.classList.add('item');
      el.dataset.sectionType = this.section.name;
      el.dataset.id = this.id;
      el.innerHTML = App.markdown(this.content);
      el.tabIndex = 1;

      el.addEventListener('keydown', this.onKeydown);

      this.el = el;

      if (this.editing) {
        this.startEditing();
      } else {
        this.awaitEditing();
      }

      return this;
    }
  }, {
    key: 'render',
    value: function render(opts) {
      if (opts.first) {
        this.section.listEl.insertBefore(this.el, this.section.listEl.firstChild);
      } else {
        this.section.listEl.appendChild(this.el);
      }

      if (this.editing) {
        this.el.focus();
      }
    }
  }, {
    key: 'detach',
    value: function detach() {
      if (!this.el.parentElement) return;
      this.section.listEl.removeChild(this.el);
    }
  }, {
    key: 'remove',
    value: function remove() {
      this.detach();
      delete this.list.items[this.id];
      // this.list.save()
      this.delete();
    }
  }, {
    key: 'show',
    value: function show() {
      this.el.style.display = '';
    }
  }, {
    key: 'hide',
    value: function hide() {
      this.el.style.display = 'none';
    }
  }, {
    key: 'startEditing',
    value: function startEditing() {
      this.editing = true;
      this.el.contentEditable = 'true';
      this.el.innerText = this.content;

      if (this.el.parentElement) {
        this.focus(); // Ensure cursor is at end
      } else {
        this.el.focus();
      }

      this.el.removeEventListener('doubletap', this.onDblClick);
      this.el.removeEventListener('touchstart', this.onTouchStart);
      this.el.removeEventListener('touchmove', this.onTouchMove);
      this.el.removeEventListener('touchend', this.onTouchEnd);
      this.el.removeEventListener('touchcancel', this.onTouchEnd);
      this.el.removeEventListener('mousedown', this.onMouseMove);
      this.el.addEventListener('blur', this.onBlur);
      this.el.addEventListener('paste', this.onPaste);
    }
  }, {
    key: 'finishEditing',
    value: function finishEditing() {
      this.editing = false;
      this.el.contentEditable = 'false';
      this.el.removeEventListener('blur', this.onBlur);
      this.el.removeEventListener('paste', this.onPaste);

      var content = this.el.innerText.replace(/\s/g, '');

      if (content) {
        this.content = content;
        this.el.innerHTML = App.markdown(content);
      } else {
        return this.remove();
      }

      this.awaitEditing();
    }
  }, {
    key: 'cancelEditing',
    value: function cancelEditing() {
      this.el.innerText = this.content;
      this.finishEditing();
    }
  }, {
    key: 'awaitEditing',
    value: function awaitEditing() {
      this.el.addEventListener('doubletap', this.onDblClick);
      this.el.addEventListener('touchstart', this.onTouchStart);
      this.el.addEventListener('touchmove', this.onTouchMove);
      this.el.addEventListener('touchend', this.onTouchEnd);
      this.el.addEventListener('touchcancel', this.onTouchEnd);
      this.el.addEventListener('mousedown', this.onMouseMove);
    }
  }, {
    key: 'updateSection',
    value: function updateSection() {
      var user = firebase.auth().currentUser;
      var itemsRef = this.list.app.db.ref('users/' + user.uid + '/items');
      var itemRef = itemsRef.child(this.key);
      itemRef.update({ group: this.section.id });
    }
  }, {
    key: 'updateContent',
    value: function updateContent() {
      var user = firebase.auth().currentUser;
      var itemsRef = this.list.app.db.ref('users/' + user.uid + '/items');

      if (this.persisted) {
        var itemRef = itemsRef.child(this.key);
        itemRef.update({ content: this.content });
      } else {
        var _itemRef = itemsRef.push();
        this.key = _itemRef.key;
        this.persisted = true;
        _itemRef.set(this.toJSON());
      }
    }
  }, {
    key: 'delete',
    value: function _delete() {
      var user = firebase.auth().currentUser;
      var itemsRef = this.list.app.db.ref('users/' + user.uid + '/items');
      var itemRef = itemsRef.child(this.key);
      itemRef.remove();
    }
  }, {
    key: 'focus',
    value: function focus() {
      this.el.focus();
      var range = document.createRange();
      range.selectNodeContents(this.el);
      range.collapse(false);
      var selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }, {
    key: 'onDblClick',
    value: function onDblClick(e) {
      this.startEditing();
    }
  }, {
    key: 'onKeydown',
    value: function onKeydown(e) {
      if (e.which === 13 && !e.shiftKey) e.preventDefault();

      if (this.editing) {
        if (e.which === 27) this.cancelEditing(); // Esc
        if (e.which === 13 && !e.shiftKey) this.el.blur(); // Enter
      } else {
        if (e.which === 13) this.startEditing(); // Enter
      }
    }
  }, {
    key: 'onBlur',
    value: function onBlur(e) {
      this.finishEditing();
    }
  }, {
    key: 'onPaste',
    value: function onPaste(e) {
      e.stopPropagation();
      e.preventDefault();

      var clipboardData = e.clipboardData || window.clipboardData;
      var pastedData = clipboardData.getData('Text');
      var selection = window.getSelection();
      var range = selection.getRangeAt(0);

      range.deleteContents();
      range.insertNode(document.createTextNode(pastedData));
      this.focus();
    }
  }, {
    key: 'onTouchStart',
    value: function onTouchStart(e) {
      var _this20 = this;

      if ('_allowDrag' in this) return;

      App.canDrag = false;

      this._timer = setTimeout(function () {
        _this20._allowDrag = App.canDrag = true;
        _this20.el.dispatchEvent(e);
        delete _this20._allowDrag;
      }, 500);
    }
  }, {
    key: 'onTouchMove',
    value: function onTouchMove(e) {
      clearTimeout(this._timer);
    }
  }, {
    key: 'onTouchEnd',
    value: function onTouchEnd(e) {
      clearTimeout(this._timer);
    }
  }, {
    key: 'onMouseMove',
    value: function onMouseMove(e) {
      clearTimeout(this._timer);
      App.canDrag = true;
    }
  }, {
    key: 'editing',
    get: function get() {
      return this._editing;
    },
    set: function set(value) {
      this._editing = value;
      this.list.app.editing = value;
    }
  }, {
    key: 'section',
    get: function get() {
      return this._section;
    },
    set: function set(value) {
      this._section = value;
      this.el.dataset.sectionId = value.name;
      // this.list.save()
      this.updateSection();
    }
  }, {
    key: 'content',
    get: function get() {
      return this._content;
    },
    set: function set(value) {
      this._content = value;
      // this.list.save()
      this.updateContent();
    }
  }]);

  return Item;
}();

var app = new App();

//# sourceMappingURL=index.js.map