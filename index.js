// Drives the app
class App {

  constructor() {
    this.el = document.querySelector('main')

    this.lists = {
      default: new List({
        app: this
      }).build()
    }

    this.lists.default.render()
  }

}

// Can have multiple lists, but only one is active
// Lists hold all the items within
class List {

  constructor(opts) {
    this.app = opts.app
    this.el = this.app.el
    this.items = {}
  }

  build() {
    this.sections = [] // Ordered, for rendering sequentially
    this.sectionByName = {} // For easy lookup
    const date = moment().startOf('day').subtract(1, 'day')

    _(7).times(n => {
      date.add(1, 'days')

      const name = date.format('YYYY-MM-DD')
      const section = new DaySection({
        list: this,
        name: name
      }).build()

      this.sections.push(section)
      this.sectionByName[name] = section
    })

    _([ DoneSection, WheneverSection, OverdueSection, BacklogSection ]).each(SectionClass => {
      const section = new SectionClass({
        list: this
      }).build()

      this.sections.push(section)
      this.sectionByName[name] = section
    })

    return this
  }

  render() {
    _(this.sections).each(section => {
      section.render()
    })
  }

}

// Represents a visual group, and is where items get rendered
class Section {

  constructor(opts) {
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

    _(this.classes).each(className => {
      section.classList.add(className)
    })

    const emoji = this.emoji()
    if (emoji) header.dataset.emoji = emoji
    header.innerText = this.title
    list.classList.add('list')

    this.el = section
    this.listEl = list

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

    item.render()
    this.list.items[item.id] = item
  }

}

class DaySection extends Section {

  constructor(opts) {
    const date = moment(opts.name, 'YYYY-MM-DD')
    const today = moment().startOf('day')
    const isToday = date.isSame(today)

    opts.name = 'day'
    super(opts)

    this.title = date.format('dddd')

    if (isToday) {
      this.title = 'Today'
      this.classes.push('today')
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

    return this
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

  build() {
    super.build()

    this.el.addEventListener('dblclick', e => {
      this.createItem({ edit: true })
    })

    return this
  }

}

// Items have an ID (not persisted) and text content and belong to a section
class Item {

  constructor(opts) {
    this.id = _.uniqueId()
    this.editing = !!opts.edit
    this._section = opts.section
    this._content = opts.content || ''
  }

  get section () {
    return this._section
  }

  set section(value) {
    this._section = value
  }

  get content() {
    return this._content
  }

  set content(value) {
    this._content = value
  }

  toJSON() {
    return {
      group: this.section.name,
      content: this.content
    }
  }

  build() {
    const el = document.createElement('article')

    el.classList.add('item')
    el.dataset.id = this.id

    if (this.editing) {
      el.contentEditable = 'true'
    }

    this.el = el

    return this
  }

  render() {
    this.section.listEl.appendChild(this.el)

    if (this.editing) {
      this.el.focus()
    }
  }

}

const app = new App()
