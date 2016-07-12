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

    this.hammer();
    this.build();
    this.observe();

    this.list = new List({
      app: this
    }).build();

    this.list.render();
  }

  _createClass(App, [{
    key: 'build',
    value: function build() {
      this.aside = document.createElement('aside');
      this.el.appendChild(this.aside);
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
      var _this = this;

      // For regular keys, use `keypress` (provides the correct char code)
      window.addEventListener('keypress', function (e) {
        if (_this.editing) return;
        if (e.metaKey) return;
        if (e.ctrlKey) return;
        if (e.altKey) return;
        if (e.which === 13) return;

        var char = String.fromCharCode(e.which);

        if (!char) return;

        _this.filtered += char;
      });

      // For special keys (esc and backspace), use `keydown`
      window.addEventListener('keydown', function (e) {
        if (_this.editing) return;
        if (e.metaKey) return;
        if (e.ctrlKey) return;
        if (e.altKey) return;
        if (e.shiftKey) return;

        if (e.which === 27) {
          // Esc
          e.preventDefault();
          _this.filtered = '';
          if (_this.list.drake.dragging) {
            _this.list.drake.cancel(true);
            if (_this.list.originalSectionId) {
              _this.list.el.dataset.active = '#' + _this.list.originalSectionId;
            }
          }
        }

        if (e.which === 8) {
          // Backspace
          e.preventDefault();
          _this.filtered = _this.filtered.slice(0, _this.filtered.length - 1);
        }
      });
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
      var tags = string.match(/\S*#(?:\[[^\]]+\]|\S+)/g);

      if (tags) {
        tags.forEach(function (tag) {
          string = string.replace(tag, '<span class="tag">' + tag + '</span>');
        });
      }

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
      var _this2 = this;

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
          list: _this2,
          date: date,
          sectionId: day
        }).build();

        section.render(_this2.el);

        _this2.sections.push(section);
        _this2.sectionById[section.id] = section;
      });

      var sectionClasses = [WeekSection, MonthSection, BacklogSection, OverdueSection, DoneSection];

      sectionClasses.forEach(function (SectionClass) {
        var section = new SectionClass({
          list: _this2
        }).build();

        section.render(_this2.el);

        _this2.sections.push(section);
        _this2.sectionById[section.id] = section;
      });

      this.dragula();
      this.load();

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
      var _this3 = this;

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

          var item = _this3.items[el.dataset.id];

          if (item.editing) {
            return false;
          }

          return true;
        },
        accepts: function accepts(el, target, source, sibling) {
          var section = _this3.sectionById[target.parentElement.dataset.id];
          var active = section.list.el.querySelector('section.over');

          if (active) {
            active.classList.remove('over');
          }

          section.el.classList.add('over');
          _this3.el.dataset.active = '#' + section.sectionId;

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
        _this3.originalSectionId = el.parentElement.parentElement.dataset.sectionId;
        el.parentElement.parentElement.classList.add('over');
      });

      this.drake.on('dragend', function (el) {
        var active = _this3.el.querySelector('section.over');

        if (active) {
          active.classList.remove('over');
        }
      });

      this.drake.on('drop', function (el, target, source, sibling) {
        var item = _this3.items[el.dataset.id];
        var section = _this3.sectionById[target.parentElement.dataset.id];
        item.section = section;
      });

      this.drake.on('cloned', function (clone, original, type) {
        var color = getComputedStyle(original).backgroundColor;
        clone.style.boxShadow = 'inset 0 0 0 50vw ' + color;
        clone.classList.remove('enlarge');
        original.classList.remove('enlarge');
      });

      this.drake.on('shadow', function (el, container, source) {
        var mirror = _this3.el.querySelector('.item.gu-mirror');
        mirror.dataset.sectionType = container.parentElement.dataset.name;
      });
    })
  }, {
    key: 'load',
    value: function load() {
      var _this4 = this;

      var items = this.stored();

      if (!items) return;

      items.forEach(function (item) {
        var section = _this4.sectionById[item.group];

        if (!section) {
          section = _this4.sectionById.overdue;
        }

        section.createItem({
          content: item.content
        });
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
      var _this5 = this;

      // Get order from the DOM
      var els = this.el.querySelectorAll('.item:not(.gu-mirror)');
      var ids = [].concat(_toConsumableArray(els)).map(function (el) {
        return el.dataset.id;
      });
      var items = ids.map(function (id) {
        return _this5.items[id];
      });
      var stringified = JSON.stringify(items);

      this._stored = null;
      localStorage.setItem('items', stringified);
    }
  }, {
    key: 'filter',
    value: function filter() {
      var _this6 = this;

      var regex = new RegExp(App.escapeRegex(this.app.filtered), 'i');

      Object.keys(this.items).forEach(function (id) {
        var item = _this6.items[id];

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
    this.classes = new Set([opts.name, opts.sectionId]);
  }

  _createClass(Section, [{
    key: 'build',
    value: function build() {
      var _this7 = this;

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
        if (e.target !== _this7.listEl && e.target !== _this7.header) return;

        var first = e.target !== _this7.listEl;

        _this7.createItem({
          edit: true,
          first: first
        });
      });

      header.addEventListener('singletap', function (e) {
        if (e.target !== header) return;

        _this7.list.el.dataset.active = '#' + _this7.sectionId;
      });

      back.addEventListener('singletap', function (e) {
        if (e.target !== back) return;

        _this7.list.el.dataset.active = '';
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

    var _this8 = _possibleConstructorReturn(this, Object.getPrototypeOf(DaySection).call(this, opts));

    _this8.date = date;
    _this8.title = date.format('dddd');

    if (isSaturday) {
      _this8.classes.add('weekend');
    }

    if (isToday && isSaturday) {
      _this8.title = 'This weekend';
    } else if (isToday) {
      _this8.title = 'Today';
    } else if (isSaturday) {
      _this8.title = 'Weekend';
    }
    return _this8;
  }

  _createClass(DaySection, [{
    key: 'build',
    value: function build() {
      _get(Object.getPrototypeOf(DaySection.prototype), 'build', this).call(this);

      var today = moment().startOf('day');
      var day = this.date.format('dddd');

      if (this.date.isSame(today)) {
        day = 'today';
      }

      if (this.date.day() === 6) {
        day = 'the weekend';
      }

      this.listEl.dataset.day = day;

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

    var _this9 = _possibleConstructorReturn(this, Object.getPrototypeOf(WeekSection).call(this, opts));

    _this9.title = 'This week';
    return _this9;
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

    var _this10 = _possibleConstructorReturn(this, Object.getPrototypeOf(MonthSection).call(this, opts));

    _this10.title = 'This month';
    return _this10;
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
      var _this12 = this;

      _get(Object.getPrototypeOf(DoneSection.prototype), 'build', this).call(this);

      var button = document.createElement('button');

      button.classList.add('clear');
      button.innerText = 'Clear';
      this.el.appendChild(button);

      button.addEventListener('singletap', function (e) {
        _this12.clear();
      });

      return this;
    }
  }, {
    key: 'clear',
    value: function clear() {
      var _this13 = this;

      Object.keys(this.list.items).forEach(function (id) {
        var item = _this13.list.items[id];
        if (item.section.id === _this13.id) {
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

    this.onDblClick = this.onDblClick.bind(this);
    this.onKeydown = this.onKeydown.bind(this);
    this.onBlur = this.onBlur.bind(this);
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
      var _this16 = this;

      var el = document.createElement('article');

      el.classList.add('item');
      el.dataset.sectionType = this.section.name;
      el.dataset.id = this.id;
      el.innerHTML = App.markdown(this.content);

      el.addEventListener('paste', function (e) {
        e.stopPropagation();
        e.preventDefault();

        var clipboardData = e.clipboardData || window.clipboardData;
        var pastedData = clipboardData.getData('Text');
        var selection = window.getSelection();
        var range = selection.getRangeAt(0);

        range.deleteContents();
        range.insertNode(document.createTextNode(pastedData));
        _this16.focus();
      });

      el.addEventListener('touchstart', function (e) {
        if ('_allowDrag' in _this16) return;

        App.canDrag = false;

        _this16._timer = setTimeout(function () {
          _this16._allowDrag = App.canDrag = true;
          _this16.el.classList.add('enlarge');
          _this16.el.dispatchEvent(e);
          delete _this16._allowDrag;
        }, 500);
      });

      el.addEventListener('touchmove', function (e) {
        clearTimeout(_this16._timer);
      });

      el.addEventListener('touchend', function (e) {
        _this16.el.classList.remove('enlarge');
      });

      el.addEventListener('touchcancel', function (e) {
        _this16.el.classList.remove('enlarge');
      });

      el.addEventListener('mousedown', function (e) {
        App.canDrag = true;
      });

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
      this.list.save();
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
      this.el.addEventListener('keydown', this.onKeydown);
      this.el.addEventListener('blur', this.onBlur);
    }
  }, {
    key: 'finishEditing',
    value: function finishEditing() {
      this.editing = false;
      this.content = this.el.innerText;
      this.el.contentEditable = 'false';
      this.el.innerHTML = App.markdown(this.content);
      this.el.removeEventListener('keydown', this.onKeydown);
      this.el.removeEventListener('blur', this.onBlur);

      if (this.el.innerText.replace(/\s/g, '') === '') {
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
      if (e.which === 27) this.cancelEditing(); // Esc
      if (e.which === 13 && !e.shiftKey) this.el.blur(); // Enter
    }
  }, {
    key: 'onBlur',
    value: function onBlur(e) {
      this.finishEditing();
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
      this.list.save();
    }
  }, {
    key: 'content',
    get: function get() {
      return this._content;
    },
    set: function set(value) {
      this._content = value;
      this.list.save();
    }
  }]);

  return Item;
}();

App.canDrag = true;

var app = new App();

//# sourceMappingURL=index.js.map