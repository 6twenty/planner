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
    const container = document.createElement('div')
    const date = moment().startOf('day').subtract(1, 'day')

    container.classList.add('top')

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
      container.appendChild(day)
    })

    this.el.appendChild(container)
  }

  renderBottomRow() {
    const container = document.createElement('div')

    container.classList.add('bottom')

    _.each([ 'sometime', 'completed', 'overdue', 'backlog' ], group => {
      const el = document.createElement('section')

      el.classList.add(group)
      el.dataset.group = group;
      el.setAttribute('data-group', group)
      el.setAttribute('data-emoji', this.emojiForGroup(group))
      container.appendChild(el)
    })

    this.el.appendChild(container)
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
    const els = this.el.querySelectorAll('section')
    _(els).toArray().each(el => {
      const group = el.dataset.group
      const handler = this[group + 'Click']
      if (!handler) return;
      el.addEventListener('dblclick', handler.bind(this))
    })
  }

  backlogClick(e) {
    if (e.target.nodeName !== 'SECTION') return;

    this.injectNewBacklogItem()
  }

  injectNewBacklogItem() {
    const backlog = this.el.querySelector('.backlog')
    const item = document.createElement('article')

    item.classList.add('item')
    item.dataset.id = _.uniqueId()
    item.dataset.group = 'backlog'
    item.setAttribute('contenteditable', 'true')
    item.addEventListener('keydown', this.itemKeydown.bind(this))
    item.addEventListener('blur', this.saveOnBlur.bind(this))
    item.addEventListener('dblclick', this.editItem.bind(this))
    backlog.appendChild(item)
    item.focus()
  }

  itemKeydown(e) {
    if (e.which === 13) e.target.blur()
    if (e.which === 27) this.revertItem(e.target)
  }

  saveOnBlur(e) {
    this.saveItem(e.target)
  }

  saveItem(el) {
    if (el.innerText.replace(/\s/g, '') === '') {
      return this.removeItem(el)
    }

    el.removeAttribute('contenteditable')

    this.items[el.dataset.id] = {
      group: el.dataset.group,
      content: el.innerText
    }

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

  editItem(e) {
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
      const item = this.items[el.dataset.id]
      item.group = target.dataset.group
      this.persistItems()
    })
  }

  loadItems() {
    const string = localStorage.getItem('items')

    if (!string) return

    const items = JSON.parse(string)

    _.each(items, item => {
      const el = this.renderItem(item)
      this.items[el.dataset.id] = item
    }, this)
  }

  renderItem(item) {
    let group = this.el.querySelector('[data-group="' + item.group + '"]')
    const el = document.createElement('article')

    // If the group can't be found, this item must be overdue
    if (!group) group = this.el.querySelector('.overdue')

    el.classList.add('item')
    el.dataset.id = _.uniqueId()
    el.dataset.group = item.group
    el.innerText = item.content

    group.appendChild(el)

    return el
  }

}

const app = new App()
