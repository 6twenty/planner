// Drives the app
class App {

  constructor() {
    this.el = document.querySelector('main')
    this.editing = false
    this._filtered = ''

    this.build()
    this.observe()

    this.list = new List({
      app: this,
      name: this.collection()
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

  collection() {
    return location.hash.replace(/^#/, '')
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

    // Changing lists via popstate
    window.addEventListener('popstate', e => {
      const collection = this.collection()

      if (collection) {
        this.list.name = collection
      } else {
        this.list.name = undefined
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
    if (opts.name) this._name = opts.name
    this.app = opts.app
    this.el = this.app.el
    this.items = {}
  }

  get name() {
    return this._name
  }

  set name(value) {
    this._name = value
    this.clear()
    this.load()
  }

  build() {
    this.sections = [] // Ordered, for rendering sequentially
    this.sectionById = {} // For easy lookup

    const date = moment().startOf('day').subtract(1, 'day')
    const times = [1,2,3,4,5,6]

    times.forEach(n => {
      date.add(1, 'days')

      if (date.day() === 0) {
        // Skip Sundays
        date.add(1, 'days')
      }

      const name = date.format('YYYY-MM-DD')
      const section = new DaySection({
        list: this,
        name: name
      }).build()

      this.sections.push(section)
      this.sectionById[name] = section
    })

    const sectionClasses = [ DoneSection, WheneverSection, OverdueSection, BacklogSection ]

    sectionClasses.forEach(SectionClass => {
      const section = new SectionClass({
        list: this
      }).build()

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

    items.forEach(item => {
      let section = this.sectionById[item.group]

      if (!section) {
        section = this.sectionById.overdue
      }

      section.createItem({
        content: item.content,
        collection: item.collection
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

  clear() {
    Object.keys(this.items).forEach(id => {
      const item = this.items[id]

      item.detach()
    })
  }

  render() {
    this.sections.forEach(section => {
      section.render()
    })
  }

  save() {
    const items = Object.keys(this.items).map(id => { return this.items[id] })
    const stringified = JSON.stringify(items)
    localStorage.setItem('items', stringified)
  }

  filter() {
    const regex = new RegExp(App.escapeRegex(this.app.filtered), 'i')

    Object.keys(this.items).forEach(id => {
      const item = this.items[id]

      if (regex.test(item.content)) {
        item.el.style.display = ''
      } else {
        item.el.style.display = 'none'
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
      this.createItem({ edit: true, first: first, collection: this.list.name })
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

    if (item.collection === this.list.name) {
      item.render({ first: opts.first })
    }

    this.list.items[item.id] = item
  }

}

class DaySection extends Section {

  constructor(opts) {
    const date = moment(opts.name, 'YYYY-MM-DD')
    const today = moment().startOf('day')
    const isToday = date.isSame(today)
    const isSaturday = date.day() === 6

    opts.id = opts.name
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

class WheneverSection extends Section {

  constructor(opts) {
    opts.name = 'whenever'
    super(opts)
  }

  emoji() {
    return '🤔'
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

  emoji() {
    return '😉'
  }

}

// Items have an ID (not persisted) and text content and belong to a section
class Item {

  constructor(opts) {
    this.id = App.uniqueId()
    this.collection = opts.collection
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
    const obj = {
      group: this.section.id,
      content: this.content
    }

    if (this.collection) {
      obj.collection = this.collection
    }

    return obj
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
