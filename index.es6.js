// Drives the app
class App {

  constructor() {
    this.el = document.body
    this.editing = false
    this._filtered = ''

    if (navigator.standalone) {
      this.el.classList.add('standalone')
    }

    const colorHash = new ColorHash({ lightness: [0.8, 0.85, 0.9], saturation: [0.8, 0.9, 1] })

    App.hsl = (string) => {
      let hsl = colorHash.hsl(string)

      // Avoid hues in the blue range
      if (hsl[0] > 200 && hsl[0] < 280) {
        hsl = App.hsl(string + '_')
      }

      return hsl
    }

    App.canDrag = true

    this.hammer()
    this.build()
    this.observe()

    this.list = new List({
      app: this
    }).build()

    this.list.render()

    this.loading()
    this.firebase().then(this.init.bind(this))
  }

  static uniqueId() {
    this._counter = this._counter || 0
    return ++this._counter
  }

  static escapeRegex(string) {
    return string.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")
  }

  static markdown(string) {
    string = string.replace(/(^|\s)(#(\w+))\b/g, (match, initial, hashtag) => {
      const hsl = App.hsl(hashtag.replace('#', ''))
      const color = `hsl(${hsl[0]}, ${hsl[1]*100}%, ${hsl[2]*100}%)`
      return `${initial}<span style="color:${color}">${hashtag}</span>`
    })

    let isWithinCodeBlock = false
    const array = string.split('')
    string = array.map((char, i) => {
      const lastChar = array[i-1]
      const nextChar = array[i+1]

      if (isWithinCodeBlock) {
        if (char === '`' && lastChar !== '`') {
          isWithinCodeBlock = false
        }
      } else {
        if (char === '`' && lastChar !== '`') {
          isWithinCodeBlock = true
        } else if (char === '-' && nextChar === '-') {
          return ''
        } else if (char === '-' && lastChar === '-') {
          return '—'
        }
      }

      return char
    }).join('')

    return marked(string)
  }

  // Examples:
  // - January 12 - 19
  // - January 12 - February 3
  static formatWeekRange(range) {
    const today = moment()
    let fromFormat = 'MMMM D'
    let toFormat = 'MMMM D'

    if (range.from.month() === range.to.month()) {
      toFormat = 'D'
    }

    const fromDate = range.from.format(fromFormat)
    const toDate = range.to.format(toFormat)

    return `${fromDate} - ${toDate}`
  }

  get env() {
    if (this._env) return this._env

    this._env = 'dev'

    if (location.hostname === 'planner-6059a.firebaseapp.com') {
      this._env = 'prod'
    }

    return this._env
  }

  get config() {
    if (this._config) return this._config

    const configs = {
      dev: {
        apiKey: "AIzaSyAqvyzUD5ioSwBSkj1zd61a_LipptjQb0M",
        authDomain: "planner-dev-73d1e.firebaseapp.com",
        databaseURL: "https://planner-dev-73d1e.firebaseio.com",
        storageBucket: "",
      },

      prod: {
        apiKey: "AIzaSyBgNTLh6iZ8itiE0-JaJJqlyUJ4aW4rB3c",
        authDomain: "planner-6059a.firebaseapp.com",
        databaseURL: "https://planner-6059a.firebaseio.com",
        storageBucket: "",
      }
    }

    this._config = configs[this.env]

    return this._config
  }

  firebase() {
    const anHourAgo = moment().subtract(1, 'hour')
    const awaitingAuthRedirect = sessionStorage.getItem('awaitingAuthRedirect')

    let isAwaitingAuthRedirect = false
    if (awaitingAuthRedirect) {
      isAwaitingAuthRedirect = moment(awaitingAuthRedirect).isAfter(anHourAgo)
      sessionStorage.removeItem('awaitingAuthRedirect')
    }

    firebase.initializeApp(this.config)

    return new Promise((resolve, reject) => {

      firebase.auth().onAuthStateChanged(user => {
        if (user || !isAwaitingAuthRedirect) {
          resolve()
        } else {
          firebase.auth().getRedirectResult().then(resolve).catch(error => {
            resolve() // TODO - show a notice?
          })
        }
      })

    })
  }

  signIn(provider) {
    this.modal.dataset.active = '#loading'
    sessionStorage.setItem('awaitingAuthRedirect', moment().format())
    const authProvider = new firebase.auth[provider]()
    firebase.auth().signInWithRedirect(authProvider)
  }

  signOut() {
    firebase.auth().signOut()
    this.list.unload()

    const settings = this.el.querySelector('.settings')
    const profile = this.el.querySelector('.profile')

    settings.innerText = ''
    profile.innerText = ''

    settings.removeAttribute('style')
    profile.removeAttribute('style')

    this.modal.dataset.active = '#providers'
  }

  loading() {
    this.modal.dataset.active = '#loading'
  }

  init() {
    const user = firebase.auth().currentUser

    if (user) {
      this.modal.dataset.active = ''

      const settings = this.el.querySelector('.settings')
      const profile = this.el.querySelector('.profile')
      const letter = user.displayName ? user.displayName[0] : '?'

      settings.innerText = letter
      profile.innerText = letter

      if (user.photoURL) {
        settings.style.backgroundImage = `url(${user.photoURL})`
        profile.style.backgroundImage = `url(${user.photoURL})`
      }

      this.list.load()
    } else {
      this.modal.dataset.active = '#providers'
    }
  }

  load(items) {
    const json = JSON.stringify(items)
    localStorage.setItem('items', json)
    this.list.load()
  }

  build() {
    this.buildAside()
    this.buildModal()
  }

  buildAside() {
    this.aside = document.createElement('aside')

    this.el.appendChild(this.aside)
  }

  buildModal() {
    this.modal = document.createElement('div')
    this.modal.classList.add('modal')

    // this.modal.dataset.active = '#providers'

    this.buildModalLoading()
    this.buildModalProviders()
    this.buildModalSettings()

    this.el.appendChild(this.modal)
  }

  buildModalLoading() {
    const section = document.createElement('section')
    const div = document.createElement('div')

    section.dataset.id = 'loading'
    div.classList.add('loading')
    section.appendChild(div)

    this.modal.appendChild(section)
  }

  buildModalProviders() {
    const section = document.createElement('section')

    section.dataset.id = 'providers'

    const a = document.createElement('a')
    const img = document.createElement('img')
    img.src = `/google.svg`
    a.classList.add('provider')
    a.appendChild(img)
    section.appendChild(a)

    a.addEventListener('singletap', e => {
      this.signIn('GoogleAuthProvider')
    })

    this.modal.appendChild(section)
  }

  buildModalSettings() {
    const section = document.createElement('section')
    const close = document.createElement('a')
    const profile = document.createElement('div')
    const signOut = document.createElement('button')

    close.classList.add('close')
    profile.classList.add('profile')
    signOut.innerText = 'Sign out'
    section.dataset.id = 'settings'
    section.appendChild(close)
    section.appendChild(profile)
    section.appendChild(signOut)

    close.addEventListener('singletap', e => {
      this.list.app.modal.dataset.active = ''
    })

    signOut.addEventListener('singletap', e => {
      this.signOut()
    })

    this.modal.appendChild(section)
  }

  renderInlineSVG(path, viewbox) {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="${viewbox}" class="svg-path">
        <path d="${path}">
      </svg>
    `
  }

  hammer() {
    this.hammer = new Hammer.Manager(this.el, { domEvents: true })

    const singleTap = new Hammer.Tap({ event: 'singletap', taps: 1 })
    const doubleTap = new Hammer.Tap({ event: 'doubletap', taps: 2 })

    this.hammer.add(doubleTap)
    this.hammer.add(singleTap)
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

      if (!char) return

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

        if (this.modal.dataset.active === '#settings') {
          this.modal.dataset.active = ''
        }

        if (document.activeElement) {
          document.activeElement.blur()
        }

        this.filtered = ''
        if (this.list.drake.dragging) {
          this.list.drake.cancel(true)
          if (this.list.originalSectionId) {
            this.list.el.dataset.active = `#${this.list.originalSectionId}`
          }
        }
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
    const days = ['today', 'tomorrow', 'day-after-tomorrow']

    // Sundays are skipped, so if today is Sunday, pretend it's Saturday
    if (moment().day() === 0) date.subtract(1, 'day')

    this.el.dataset.active = ''

    days.forEach(day => {
      date.add(1, 'days')

      if (date.day() === 0) {
        // Skip Sundays
        date.add(1, 'days')
      }

      const section = new DaySection({
        list: this,
        date: date,
        sectionId: day
      }).build()

      section.render(this.el)

      this.sections.push(section)
      this.sectionById[section.id] = section
    })


    const sectionClasses = [ WeekSection, MonthSection, BacklogSection, OverdueSection, DoneSection ]

    sectionClasses.forEach(SectionClass => {
      const section = new SectionClass({
        list: this
      }).build()

      section.render(this.el)

      this.sections.push(section)
      this.sectionById[section.id] = section
    })

    this.dragula()

    return this
  }

  dragula() {
    const lists = this.sections.map(section => { return section.listEl })
    const headers = this.sections.map(section => { return section.header })
    const els = [...lists, ...headers]

    this.drake = dragula({
      containers: els,
      mirrorContainer: this.el,
      moves: (el, source, handle, sibling) => {
        if (source.nodeName === 'HEADER') {
          return false
        }

        if (!App.canDrag) {
          return false
        }

        const item = this.items[el.dataset.id]

        if (item.editing) {
          return false
        }

        return true
      },
      accepts: (el, target, source, sibling) => {
        const section = this.sectionById[target.parentElement.dataset.id]
        const active = section.list.el.querySelector('section.over')

        if (active) {
          active.classList.remove('over')
        }

        section.el.classList.add('over')
        this.el.dataset.active = `#${section.sectionId}`

        if (target.nodeName === 'HEADER') {
          if (target.parentElement === el.parentElement.parentElement) {
            return false
          }

          section.listEl.insertBefore(el, section.listEl.firstChild)

          return false
        }

        return true
      }
    })

    this.drake.on('drag', (el) => {
      this.originalSectionId = el.parentElement.parentElement.dataset.sectionId
      el.parentElement.parentElement.classList.add('over')
    })

    this.drake.on('dragend', (el) => {
      const active = this.el.querySelector('section.over')

      if (active) {
        active.classList.remove('over')
      }
    })

    this.drake.on('drop', (el, target, source, sibling) => {
      const item = this.items[el.dataset.id]
      const section = this.sectionById[target.parentElement.dataset.id]
      item.section = section
    })

    this.drake.on('cloned', (clone, original, type) => {
      const color = getComputedStyle(original).backgroundColor
      clone.style.boxShadow = `inset 0 0 0 50vw ${color}`
    })

    this.drake.on('shadow', (el, container, source) => {
      const mirror = this.el.querySelector('.item.gu-mirror')
      mirror.dataset.sectionType = container.parentElement.dataset.name
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

  unload() {
    const ids = Object.keys(this.items)

    ids.forEach(id => {
      const item = this.items[id]

      item.detach()

      delete this.items[id]
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
    this.sectionId = opts.sectionId
    this.classes = new Set()
    this.classes.add(opts.name)
    this.classes.add(opts.sectionId)
  }

  build() {
    const section = document.createElement('section')
    const header = document.createElement('header')
    const back = document.createElement('button')
    const list = document.createElement('div')
    section.appendChild(header)
    section.appendChild(list)

    section.dataset.id = this.id
    section.dataset.name = this.name
    section.dataset.sectionId = this.sectionId
    this.classes.forEach(className => {
      section.classList.add(className)
    })

    const emoji = this.emoji()
    if (emoji) header.dataset.emoji = emoji
    header.innerText = this.title
    back.classList.add('back')
    list.classList.add('list')
    header.appendChild(back)

    this.el = section
    this.header = header
    this.listEl = list

    this.el.addEventListener('doubletap', e => {
      if (e.target !== this.listEl && e.target !== this.header) return

      const first = e.target !== this.listEl

      this.createItem({
        edit: true,
        first: first
      })
    })

    header.addEventListener('singletap', e => {
      if (e.target !== header) return

      this.list.el.dataset.active = `#${this.sectionId}`
    })

    back.addEventListener('singletap', e => {
      if (e.target !== back) return

      this.list.el.dataset.active = ''
    })

    return this
  }

  emoji() {

  }

  render(parent) {
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

    if (today.day() === 0) {
      today.subtract(1, 'day')
    }

    const isToday = date.isSame(today)
    const isSaturday = date.day() === 6

    opts.id = date.format('YYYY-MM-DD')
    opts.name = 'day'
    super(opts)

    this.date = date
    this.title = date.format('dddd')

    if (isSaturday) {
      this.classes.add('weekend')
    }

    if (isToday && isSaturday) {
      this.title = 'This weekend'
    } else if (isToday) {
      this.title = 'Today'
    } else if (isSaturday) {
      this.title = 'Weekend'
    }
  }

  build() {
    super.build()

    const today = moment().startOf('day')
    let day = this.date.format('dddd')

    if (today.day() === 0) {
      today.subtract(1, 'day')
    }

    if (this.date.isSame(today)) {
      day = 'today'
    }

    if (this.date.day() === 6) {
      day = 'the weekend'
    }

    this.listEl.dataset.day = day

    if (this.date.isSame(today)) {
      const settings = document.createElement('a')

      settings.classList.add('settings')

      settings.addEventListener('singletap', e => {
        this.list.app.modal.dataset.active = '#settings'
      })

      this.header.appendChild(settings)
    }

    return this
  }

}

class WeekSection extends Section {

  constructor(opts) {
    const dateStart = moment().startOf('week')
    const dateEnd = moment().endOf('week')

    opts.id = `${dateStart.format('YYYY-MM-DD')}-${dateEnd.format('YYYY-MM-DD')}`
    opts.name = 'week'
    opts.sectionId = 'week'
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
    opts.sectionId = 'month'
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
    opts.sectionId = 'done'
    super(opts)
  }

  emoji() {
    return '😍'
  }

  build() {
    super.build()

    const button = document.createElement('button')

    button.classList.add('clear')
    button.innerText ='Clear'
    this.el.appendChild(button)

    button.addEventListener('singletap', e => {
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
    opts.sectionId = 'overdue'
    super(opts)
  }

  emoji() {
    return '😰'
  }

}

class BacklogSection extends Section {

  constructor(opts) {
    opts.name = 'backlog'
    opts.sectionId = 'backlog'
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

    // Explicit bindings
    this.onDblClick = this.onDblClick.bind(this)
    this.onKeydown = this.onKeydown.bind(this)
    this.onBlur = this.onBlur.bind(this)
    this.onPaste = this.onPaste.bind(this)
    this.onTouchStart = this.onTouchStart.bind(this)
    this.onTouchMove = this.onTouchMove.bind(this)
    this.onTouchEnd = this.onTouchEnd.bind(this)
    this.onMouseMove = this.onMouseMove.bind(this)
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
    this.el.dataset.sectionId = value.name
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
    el.dataset.sectionType = this.section.name
    el.dataset.id = this.id
    el.innerHTML = App.markdown(this.content)
    el.tabIndex = 1

    el.addEventListener('keydown', this.onKeydown)

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

    this.el.removeEventListener('doubletap', this.onDblClick)
    this.el.removeEventListener('touchstart', this.onTouchStart)
    this.el.removeEventListener('touchmove', this.onTouchMove)
    this.el.removeEventListener('touchend', this.onTouchEnd)
    this.el.removeEventListener('touchcancel', this.onTouchEnd)
    this.el.removeEventListener('mousedown', this.onMouseMove)
    this.el.addEventListener('blur', this.onBlur)
    this.el.addEventListener('paste', this.onPaste)
  }

  finishEditing() {
    this.editing = false
    this.content = this.el.innerText
    this.el.contentEditable = 'false'
    this.el.innerHTML = App.markdown(this.content)
    this.el.removeEventListener('blur', this.onBlur)
    this.el.removeEventListener('paste', this.onPaste)

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
    this.el.addEventListener('doubletap', this.onDblClick)
    this.el.addEventListener('touchstart', this.onTouchStart)
    this.el.addEventListener('touchmove', this.onTouchMove)
    this.el.addEventListener('touchend', this.onTouchEnd)
    this.el.addEventListener('touchcancel', this.onTouchEnd)
    this.el.addEventListener('mousedown', this.onMouseMove)
  }

  focus() {
    this.el.focus()
    const range = document.createRange()
    range.selectNodeContents(this.el)
    range.collapse(false)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
  }

  onDblClick(e) {
    this.startEditing()
  }

  onKeydown(e) {
    if (e.which === 13 && !e.shiftKey) e.preventDefault()

    if (this.editing) {
      if (e.which === 27) this.cancelEditing() // Esc
      if (e.which === 13 && !e.shiftKey) this.el.blur() // Enter
    } else {
      if (e.which === 13) this.startEditing() // Enter
    }
  }

  onBlur(e) {
    this.finishEditing()
  }

  onPaste(e) {
    e.stopPropagation()
    e.preventDefault()

    const clipboardData = e.clipboardData || window.clipboardData
    const pastedData = clipboardData.getData('Text')
    const selection = window.getSelection()
    const range = selection.getRangeAt(0)

    range.deleteContents()
    range.insertNode(document.createTextNode(pastedData))
    this.focus()
  }

  onTouchStart(e) {
    if ('_allowDrag' in this) return

    App.canDrag = false

    this._timer = setTimeout(() => {
      this._allowDrag = App.canDrag = true
      this.el.dispatchEvent(e)
      delete this._allowDrag
    }, 500)
  }

  onTouchMove(e) {
    clearTimeout(this._timer)
  }

  onTouchEnd(e) {
    clearTimeout(this._timer)
  }

  onMouseMove(e) {
    clearTimeout(this._timer)
    App.canDrag = true
  }

}

const app = new App()
