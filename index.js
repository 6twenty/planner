// Drives the app
class App {

  constructor() {
    this.el = document.body
    this.editing = false
    this._filtered = ''

    this.build()
    this.observe()

    this.list = new List({
      app: this
    }).build()

    this.list.render()
  }

  static uniqueId() {
    this._counter = this._counter || 0
    return ++this._counter
  }

  static escapeRegex(string) {
    return string.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
  }

  // Examples:
  // - January 12 - 19
  // - January 12 - February 3
  static formatWeekRange(range) {
    const today = moment()
    let fromFormat = 'MMMM D'
    let toFormat = 'MMMM D'

    fromFormat = 'MMMM D';

    if (range.from.month() === range.to.month()) {
      toFormat = 'D'
    }

    const fromDate = range.from.format(fromFormat)
    const toDate = range.to.format(toFormat)

    return `${fromDate} - ${toDate}`
  }

  build() {
    this.aside = document.createElement('aside')
    this.el.appendChild(this.aside)
  }

  observe() {

    // For regular keys, use `keypress` (provides the correct char code)
    window.addEventListener('keypress', e => {
      if (this.editing) return
      if (e.metaKey) return
      if (e.ctrlKey) return
      if (e.altKey) return
      if (e.which === 13) return

      const char = String.fromCharCode(e.which)

      if (!char) return;

      this.filtered += char
    })

    // For special keys (esc and backspace), use `keydown`
    window.addEventListener('keydown', e => {
      if (this.editing) return
      if (e.metaKey) return
      if (e.ctrlKey) return
      if (e.altKey) return
      if (e.shiftKey) return

      if (e.which === 27) { // Esc
        e.preventDefault()
        this.filtered = ''
      }

      if (e.which === 8) { // Backspace
        e.preventDefault()
        this.filtered = this.filtered.slice(0, this.filtered.length - 1)
      }
    })

  }

  get filtered() {
    return this._filtered
  }

  set filtered(value) {
    this._filtered = value
    this.aside.innerText = value
    this.list.filter()
  }

}

// Can have multiple lists, but only one is active
// Lists hold all the items within
class List {

  constructor(opts) {
    if (opts.name) this.name = opts.name
    this.app = opts.app
    this.el = document.createElement('main')
    this.items = {}
  }

  build() {
    this.sections = [] // Ordered, for rendering sequentially
    this.sectionById = {} // For easy lookup

    const date = moment().startOf('day').subtract(1, 'day')
    const times = [1,2,3]

    times.forEach(n => {
      date.add(1, 'days')

      if (date.day() === 0) {
        // Skip Sundays
        date.add(1, 'days')
      }

      const section = new DaySection({
        list: this,
        date: date
      }).build()

      section.render()

      this.sections.push(section)
      this.sectionById[section.id] = section
    })


    const sectionClasses = [ OverdueSection, WeekSection, MonthSection, BacklogSection, DoneSection ]

    sectionClasses.forEach(SectionClass => {
      const section = new SectionClass({
        list: this
      }).build()

      section.render()

      this.sections.push(section)
      this.sectionById[section.id] = section
    })

    this.dragula()
    this.load()

    return this
  }

  dragula() {
    const els = this.sections.map(section => { return section.listEl })

    const drake = dragula({
      containers: els,
      mirrorContainer: this.el,
      moves: (el, source, handle, sibling) => {
        const item = this.items[el.dataset.id]
        if (item.editing) return false
        return true
      }
    })

    drake.on('drop', (el, target, source, sibling) => {
      const item = this.items[el.dataset.id]
      const section = this.sectionById[target.parentElement.dataset.id]
      item.section = section
    })
  }

  load() {
    const items = this.stored()

    if (!items) return

    items.forEach(item => {
      let section = this.sectionById[item.group]

      if (!section) {
        section = this.sectionById.overdue
      }

      section.createItem({
        content: item.content
      })
    })
  }

  stored() {
    if (this._stored) {
      return this._stored
    }

    const stored = localStorage.getItem('items')
    if (!stored) return

    let items = JSON.parse(stored)

    // If `items` is a key/value object it needs to be converted to a simple array
    if (!Array.isArray(items)) {
      items = Object.keys(items).map(id => { return items[id] })
    }

    this._stored = items

    return items
  }

  render() {
    this.app.el.appendChild(this.el)
  }

  save() {
    // Get order from the DOM
    const els = this.el.querySelectorAll('.item:not(.gu-mirror)')
    const ids = [...els].map(el => { return el.dataset.id })
    const items = ids.map(id => { return this.items[id] })
    const stringified = JSON.stringify(items)

    this._stored = null
    localStorage.setItem('items', stringified)
  }

  filter() {
    const regex = new RegExp(App.escapeRegex(this.app.filtered), 'i')

    Object.keys(this.items).forEach(id => {
      const item = this.items[id]

      if (regex.test(item.content)) {
        item.show()
      } else {
        item.hide()
      }
    })
  }

}

// Represents a visual group, and is where items get rendered
class Section {

  constructor(opts) {
    this.id = opts.id || opts.name
    this.list = opts.list
    this.name = opts.name
    this.title = opts.name
    this.classes = [opts.name]
  }

  build() {
    const section = document.createElement('section')
    const header = document.createElement('header')
    const list = document.createElement('div')
    section.appendChild(header)
    section.appendChild(list)

    section.dataset.id = this.id
    this.classes.forEach(className => {
      section.classList.add(className)
    })

    const emoji = this.emoji()
    if (emoji) header.dataset.emoji = emoji
    header.innerText = this.title
    list.classList.add('list')

    this.el = section
    this.listEl = list

    this.el.addEventListener('dblclick', e => {
      if (e.target !== this.listEl && e.target.nodeName !== 'HEADER') return;

      const first = e.target !== this.listEl

      this.createItem({
        edit: true,
        first: first
      })
    })

    return this
  }

  emoji() {

  }

  render() {
    const parent = this.list.el
    parent.appendChild(this.el)
  }

  createItem(opts) {
    opts.section = this

    const item = new Item(opts).build()

    item.render({ first: opts.first })

    this.list.items[item.id] = item
  }

}

class DaySection extends Section {

  constructor(opts) {
    const date = opts.date
    const today = moment().startOf('day')
    const isToday = date.isSame(today)
    const isSaturday = date.day() === 6

    opts.id = date.format('YYYY-MM-DD')
    opts.name = 'day'
    super(opts)

    this.title = date.format('dddd')

    if (isToday) {
      this.title = 'Today'
      this.classes.push('today')
    } else if (isSaturday) {
      this.title = 'Weekend'
      this.classes.push('weekend')
    }
  }

}

class WeekSection extends Section {

  constructor(opts) {
    const dateStart = moment().startOf('week')
    const dateEnd = moment().endOf('week')

    opts.id = `${dateStart.format('YYYY-MM-DD')}-${dateEnd.format('YYYY-MM-DD')}`
    opts.name = 'week'
    super(opts)

    this.title = 'This week'
  }

  build() {
    const dateStart = moment().startOf('week')
    const dateEnd = moment().endOf('week')

    super.build()

    this.listEl.dataset.dates = App.formatWeekRange({ from: dateStart, to: dateEnd })

    return this
  }

}

class MonthSection extends Section {

  constructor(opts) {
    const dateStart = moment().startOf('month')
    const dateEnd = moment().endOf('month')

    opts.id = `${dateStart.format('YYYY-MM-DD')}-${dateEnd.format('YYYY-MM-DD')}`
    opts.name = 'month'
    super(opts)

    this.title = 'This month'
  }

  build() {
    const date = moment()

    super.build()

    this.listEl.dataset.date = date.format('MMMM')

    return this
  }

}

class DoneSection extends Section {

  constructor(opts) {
    opts.name = 'done'
    super(opts)
  }

  emoji() {
    return '😍'
  }

  build() {
    super.build()

    const button = document.createElement('button')

    button.innerText ='Clear'
    this.el.appendChild(button)

    button.addEventListener('click', e => {
      this.clear()
    })

    return this
  }

  clear() {
    Object.keys(this.list.items).forEach(id => {
      const item = this.list.items[id]
      if (item.section.id === this.id) {
        item.remove()
      }
    })
  }

}

class OverdueSection extends Section {

  constructor(opts) {
    opts.name = 'overdue'
    super(opts)
  }

  emoji() {
    return '😰'
  }

}

class BacklogSection extends Section {

  constructor(opts) {
    opts.name = 'backlog'
    super(opts)
  }

}

// Items have an ID (not persisted) and text content and belong to a section
class Item {

  constructor(opts) {
    this.id = App.uniqueId()
    this._editing = !!opts.edit
    this._section = opts.section
    this._content = opts.content || ''
    this.list = this._section.list

    this.onDblClick = this.onDblClick.bind(this)
    this.onKeydown = this.onKeydown.bind(this)
    this.onBlur =this.onBlur.bind(this)
  }

  get editing () {
    return this._editing
  }

  set editing(value) {
    this._editing = value
    this.list.app.editing = value
  }

  get section () {
    return this._section
  }

  set section(value) {
    this._section = value
    this.list.save()
  }

  get content() {
    return this._content
  }

  set content(value) {
    this._content = value
    this.list.save()
  }

  toJSON() {
    return {
      group: this.section.id,
      content: this.content
    }
  }

  build() {
    const el = document.createElement('article')

    el.classList.add('item')
    el.dataset.id = this.id
    el.innerHTML = marked(this.content)

    this.el = el

    if (this.editing) {
      this.startEditing()
    } else {
      this.awaitEditing()
    }

    return this
  }

  render(opts) {
    if (opts.first) {
      this.section.listEl.insertBefore(this.el, this.section.listEl.firstChild)
    } else {
      this.section.listEl.appendChild(this.el)
    }

    if (this.editing) {
      this.el.focus()
    }
  }

  detach() {
    if (!this.el.parentElement) return
    this.section.listEl.removeChild(this.el)
  }

  remove() {
    this.detach()
    delete this.list.items[this.id]
    this.list.save()
  }

  show() {
    this.el.style.display = ''
  }

  hide() {
    this.el.style.display = 'none'
  }

  startEditing() {
    this.editing = true
    this.el.contentEditable = 'true'
    this.el.innerText = this.content

    if (this.el.parentElement) {
      this.focus() // Ensure cursor is at end
    } else {
      this.el.focus()
    }

    this.el.removeEventListener('dblclick', this.onDblClick)
    this.el.addEventListener('keydown', this.onKeydown)
    this.el.addEventListener('blur', this.onBlur)
  }

  finishEditing() {
    this.editing = false
    this.content = this.el.innerText
    this.el.contentEditable = 'false'
    this.el.innerHTML = marked(this.content)
    this.el.removeEventListener('keydown', this.onKeydown)
    this.el.removeEventListener('blur', this.onBlur)

    if (this.el.innerText.replace(/\s/g, '') === '') {
      return this.remove()
    }

    this.awaitEditing()
  }

  cancelEditing() {
    this.el.innerText = this.content
    this.finishEditing()
  }

  awaitEditing() {
    this.el.addEventListener('dblclick', this.onDblClick)
  }

  focus() {
    this.el.focus()
    const range = document.createRange();
    range.selectNodeContents(this.el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  onDblClick(e) {
    this.startEditing()
  }

  onKeydown(e) {
    if (e.which === 27) this.cancelEditing() // Esc
    if (e.which === 13 && !e.shiftKey) this.el.blur() // Enter
  }

  onBlur(e) {
    this.finishEditing()
  }

}

const app = new App()
