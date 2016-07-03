// TODO:
// - Unify item rendering between creating a new item and rendering loaded items

class App {

  constructor() {
    this.el = document.querySelector('main')
    this.items = {}
    this.sections = {}

    this.renderLayout()
    this.bindEvents()
    this.initDragula()
    this.loadItems()
  }

  // Renders the base skeleton markup
  renderLayout() {
    this.renderTopRow()
    this.renderBottomRow()
    this.renderControls()
  }

  renderTopRow() {
    const date = moment().startOf('day').subtract(1, 'day')

    _.times(7, n => {
      date.add(1, 'days')

      const group = date.format('YYYY-MM-DD')
      let title = date.format('dddd')
      if (n === 0) title = 'Today'
      let classes = ['day']
      if (n === 0) classes.push('today')

      this.renderSection({
        group: group,
        title: title,
        classes: classes
      })
    })
  }

  renderBottomRow() {
    _.each([ 'completed', 'sometime', 'overdue', 'backlog' ], group => {
      this.renderSection({
        group: group,
        title: group,
        classes: [group]
      })
    })
  }

  renderSection(opts) {
    const section = document.createElement('section')
    const header = document.createElement('header')
    const list = document.createElement('div')
    const emoji = this.emojiForGroup(opts.group)

    header.innerText = opts.title
    if (emoji) header.setAttribute('data-emoji', emoji)
    section.appendChild(header)

    list.classList.add('list')
    section.appendChild(list)

    section.dataset.group = opts.group

    _.each(opts.classes, className => {
      section.classList.add(className)
    })

    this.el.appendChild(section)
    this.sections[opts.group] = section
  }

  emojiForGroup(group) {
    switch (group) {
      case 'sometime':
        return '🤔';
      case 'completed':
        return '😍';
      case 'overdue':
        return '😰';
      case 'backlog':
        return '😉';
    }
  }

  renderControls() {
    const completed = this.el.querySelector('.completed')
    const button = document.createElement('button')

    button.classList.add('clear')
    button.innerText = 'Clear'
    completed.appendChild(button)

    button.addEventListener('click', e => {
      if (!e.target.classList.contains('clear')) return;

      this.clearCompleted()
    })
  }

  bindEvents() {
    this.el.querySelector('.backlog .list').addEventListener('dblclick', e => {
      if (!e.target.classList.contains('list')) return;

      const item = {}

      this.renderItem(item, e.target, { edit: true })

      this.items[item.id] = item
    })
  }

  clearCompleted() {
    const list = this.el.querySelector('.completed .list')
    const els = list.querySelectorAll('.item')

    _(els).toArray().each(el => {
      el.parentElement.removeChild(el)
    })

    _.forOwn(this.items, (item, id) => {
      if (item.group === 'completed') {
        delete this.items[id]
      }
    })

    this.persistItems()
  }

  renderItem(item, target, opts) {
    const el = document.createElement('article')

    item.id = _.uniqueId()
    item.group = item.group || 'backlog'

    el.classList.add('item')
    el.dataset.id = item.id

    el.addEventListener('keydown', this.itemKeydown.bind(this))
    el.addEventListener('blur', this.itemBlur.bind(this))
    el.addEventListener('dblclick', this.itemEdit.bind(this))

    if (item.content) {
      el.innerText = item.content
    }

    target.appendChild(el)

    if (opts.edit) {
      el.setAttribute('contenteditable', 'true')
      el.focus()
    }

    return el
  }

  itemKeydown(e) {
    if (!e.target.classList.contains('item')) return
    if (e.target.getAttribute('contenteditable') !== 'true') return;
    if (e.which === 13) e.target.blur() // Enter
    if (e.which === 27) this.revertItem(e.target) // Esc
  }

  itemBlur(e) {
    if (!e.target.classList.contains('item')) return
    if (e.target.getAttribute('contenteditable') !== 'true') return;
    this.saveItem(e.target)
  }

  saveItem(el) {
    if (el.innerText.replace(/\s/g, '') === '') {
      return this.removeItem(el)
    }

    const item = this.items[el.dataset.id]

    item.content = el.innerText
    el.removeAttribute('contenteditable')

    this.persistItems()
  }

  revertItem(el) {
    el.removeAttribute('contenteditable')
    el.innerText = this.items[el.dataset.id].content
  }

  removeItem(el) {
    delete this.items[el.dataset.id]

    el.parentElement.removeChild(el)

    this.persistItems()
  }

  itemEdit(e) {
    e.target.setAttribute('contenteditable', 'true')
    e.target.focus()
  }

  persistItems() {
    const string = JSON.stringify(this.items)
    localStorage.setItem('items', string)
  }

  initDragula() {
    const els = this.el.querySelectorAll('section .list')

    const drake = dragula({
      containers: _.toArray(els),
      mirrorContainer: this.el,
      moves: (el, source, handle, sibling) => {
        if (el.getAttribute('contenteditable') === 'true') return false
        return true
      }
    })

    drake.on('drop', (el, target, source, sibling) => {
      const item = this.items[el.dataset.id]
      const group = target.parentElement.dataset.group

      item.group = group
      this.persistItems()
    })
  }

  loadItems() {
    const string = localStorage.getItem('items')

    if (!string) return

    const items = JSON.parse(string)

    _.each(items, item => {
      let target = this.sections[item.group]

      // If the group can't be found, this item must be overdue
      if (!target) target = this.el.querySelector('.overdue')

      target = target.querySelector('.list')

      const el = this.renderItem(item, target, {})

      this.items[item.id] = item
    }, this)
  }

}

const app = new App()
