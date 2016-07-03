// TODO:
// - Unify item rendering between creating a new item and rendering loaded items

class App {

  constructor() {
    this.el = document.querySelector('main')
    this.items = {}

    this.renderLayout()
    this.bindEvents()
    this.initDragula()
    this.loadItems()
  }

  // Renders the base skeleton markup
  renderLayout() {
    this.renderTopRow()
    this.renderBottomRow()
  }

  renderTopRow() {
    const date = moment().startOf('day').subtract(1, 'day')

    _.times(7, n => {
      const day = document.createElement('section')
      let title = date.format('dddd')
      if (n === 0) title = 'Today'

      date.add(1, 'days')
      day.classList.add('day')
      if (n === 0) day.classList.add('today')
      day.dataset.group = date.format('YYYY-MM-DD')
      day.setAttribute('data-group', date.format('YYYY-MM-DD'))
      day.setAttribute('data-title', title)
      this.el.appendChild(day)
    })
  }

  renderBottomRow() {
    _.each([ 'sometime', 'completed', 'overdue', 'backlog' ], group => {
      const el = document.createElement('section')

      el.classList.add(group)
      el.dataset.group = group;
      el.setAttribute('data-group', group)
      el.setAttribute('data-emoji', this.emojiForGroup(group))
      el.setAttribute('data-title', group)
      this.el.appendChild(el)
    })
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

  bindEvents() {
    this.el.querySelector('.backlog').addEventListener('dblclick', e => {
      if (!e.target.classList.contains('backlog')) return;
      this.renderItem({}, e.target, { edit: true })
    })
  }

  renderItem(item, target, opts) {
    const el = document.createElement('article')

    item.id = _.uniqueId()
    item.group = item.group || 'backlog'

    el.classList.add('item')
    el.dataset.item = item

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

    el.removeAttribute('contenteditable')

    this.items[el.dataset.item.id] = {
      group: el.dataset.item.group,
      content: el.innerText
    }

    this.persistItems()
  }

  revertItem(el) {
    el.removeAttribute('contenteditable')
    el.innerText = this.items[el.dataset.item.id].content
  }

  removeItem(el) {
    delete this.items[el.dataset.item.id]

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
    const els = this.el.querySelectorAll('section')

    const drake = dragula({
      containers: _.toArray(els),
      mirrorContainer: this.el,
      moves: (el, source, handle, sibling) => {
        if (el.getAttribute('contenteditable') === 'true') return false
        return true
      }
    })

    drake.on('drop', (el, target, source, sibling) => {
      const item = this.items[el.dataset.item.id]
      item.group = target.dataset.group
      this.persistItems()
    })
  }

  loadItems() {
    const string = localStorage.getItem('items')

    if (!string) return

    const items = JSON.parse(string)

    _.each(items, item => {
      let target = this.el.querySelector('[data-group="' + item.group + '"]')

      // If the group can't be found, this item must be overdue
      if (!target) target = this.el.querySelector('.overdue')

      const el = this.renderItem(item, target, {})

      this.items[item.id] = item
    }, this)
  }

}

const app = new App()