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
    this.sectionById = {} // For easy lookup
    const date = moment().startOf('day').subtract(1, 'day')

    _(7).times(n => {
      date.add(1, 'days')

      const name = date.format('YYYY-MM-DD')
      const section = new DaySection({
        list: this,
        name: name
      }).build()

      this.sections.push(section)
      this.sectionById[name] = section
    })

    _([ DoneSection, WheneverSection, OverdueSection, BacklogSection ]).each(SectionClass => {
      const section = new SectionClass({
        list: this
      }).build()

      this.sections.push(section)
      this.sectionById[section.id] = section
    })

    this.dragula()

    return this
  }

  dragula() {
    const els = _(this.sections).map('listEl').value()

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

  render() {
    _(this.sections).each(section => {
      section.render()
    })
  }

  save() {
    const items = _(this.items).values().value()
    const stringified = JSON.stringify(items)
    localStorage.setItem('items', stringified)
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

    opts.id = opts.name
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

    button.addEventListener('click', e => {
      this.clear()
    })

    return this
  }

  clear() {
    _(this.list.items).forOwn((item, id) => {
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

  build() {
    super.build()

    this.el.addEventListener('dblclick', e => {
      if (e.target !== this.listEl) return;
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
    this.list = this._section.list

    this.onDblClick = this.onDblClick.bind(this)
    this.onKeydown = this.onKeydown.bind(this)
    this.onBlur =this.onBlur.bind(this)
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

    this.el = el

    if (this.editing) {
      this.startEditing()
    } else {
      this.awaitEditing()
    }

    return this
  }

  render() {
    this.section.listEl.appendChild(this.el)

    if (this.editing) {
      this.el.focus()
    }
  }

  remove() {
    this.section.listEl.removeChild(this.el)
    delete this.list.items[this.id]
    this.list.save()
  }

  startEditing() {
    this.editing = true
    this.el.contentEditable = 'true'

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
    this.el.contentEditable = 'false'
    this.el.removeEventListener('keydown', this.onKeydown)
    this.el.removeEventListener('blur', this.onBlur)

    if (this.el.innerText.replace(/\s/g, '') === '') {
      return this.remove()
    }

    this.content = this.el.innerText

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
    if (e.which === 13) this.el.blur() // Enter
  }

  onBlur(e) {
    this.finishEditing()
  }

}

const app = new App()
