var IncrementalDOM = require('incremental-dom');

var elementClose = IncrementalDOM.elementClose,
    elementOpen = IncrementalDOM.elementOpen,
    patch = IncrementalDOM.patch,
    text = IncrementalDOM.text;

/**
 * TypeAhead
 *
 * @constructor
 * @param {HTMLInputElement} element
 * @param {Array} candidates
 */
var TypeAhead = function (element, candidates, opts) {
    var typeAhead = this;
    opts = opts || {};

    typeAhead.element = element;

    typeAhead.candidates = candidates || [];

    typeAhead.list = new TypeAheadList(typeAhead);

    this.minLength = opts.hasOwnProperty('minLength') ? opts.minLength : 3;

    typeAhead.limit = opts.hasOwnProperty('limit') ? opts.limit : 5;

    typeAhead.onMouseDown = opts.hasOwnProperty('onMouseDown') ? opts.onMouseDown : function(){};

    typeAhead.onKeyDown = opts.hasOwnProperty('onKeyDown') ? opts.onKeyDown : function(){};

    typeAhead.fulltext = opts.hasOwnProperty('fulltext') ? opts.fulltext : false;

    typeAhead.scrollable = opts.hasOwnProperty('scrollable') ? opts.scrollable : false;

    typeAhead.callback = opts.hasOwnProperty('callback') ? opts.callback : function(){};

    typeAhead.query = '';

    typeAhead.selected = null;

    typeAhead.element.addEventListener('keyup', function (event) {
        typeAhead.handleKeyUp.call(typeAhead, event.keyCode);
    }, false);

    typeAhead.element.addEventListener('keydown', function (event) {
        typeAhead.handleKeyDown.call(typeAhead, event.keyCode) && event.preventDefault();
    });

    typeAhead.element.addEventListener('focus', function () {
        typeAhead.handleFocus.call(typeAhead);
    });

    typeAhead.element.addEventListener('blur', function () {
        typeAhead.handleBlur.call(typeAhead);
    });

    typeAhead.update = function(candidates){
      this.candidates = candidates;
      typeAhead.handleKeyUp.call(typeAhead);
    }

    return typeAhead;
};

/**
 * Key up event handler
 *
 * @param {Integer} keyCode
 */
TypeAhead.prototype.handleKeyUp = function (keyCode) {
    if (keyCode === 13 || keyCode === 38 || keyCode === 40) {
        return;
    }

    this.query = this.filter(this.element.value);

    this.list.clear();

    if (this.query.length < this.minLength) {
        this.list.draw();
        return;
    }

    var typeAhead = this;
    this.getCandidates(function (candidates) {
        for (var i = 0; i < candidates.length; i++) {
            typeAhead.list.add(candidates[i]);
            if (typeAhead.limit !== false && i === typeAhead.limit) {
                break;
            }
        }
        typeAhead.list.draw();
    });
};

/**
 * Key down event handler
 *
 * @param {Integer} keyCode
 * @return {Boolean} Whether event should be captured or not
 */
TypeAhead.prototype.handleKeyDown = function (keyCode) {
    if (keyCode === 13 && !this.list.isEmpty()) {
        this.value(this.list.items[this.list.active]);
        this.list.hide();
        this.onKeyDown(this.list.items[this.list.active]);
        return true;
    }

    if (keyCode === 38) {
        this.list.previous();
        return true;
    }

    if (keyCode === 40) {
        this.list.next();
        return true;
    }

    return false;
};

/**
 * Input blur event handler
 */
TypeAhead.prototype.handleBlur = function () {
    this.list.hide();
};

/**
 * Input focus event handler
 */
TypeAhead.prototype.handleFocus = function () {
    if (!this.list.isEmpty()) {
        this.list.show();
    }
};

/**
 * Filters values before running matcher
 *
 * @param {string} value
 * @return {Boolean}
 */
TypeAhead.prototype.filter = function (value) {
    value = value.toLowerCase();
    return value;
};

/**
 * Compares query to candidate
 *
 * @param {string} candidate
 * @return {Boolean}
 */
TypeAhead.prototype.match = function (candidate) {
    var matches, keywords;
    if (this.fulltext){
        matches = 0;
        keywords = this.query.split(/\s+/);
        for (var i = 0; i < keywords.length; i++) {
          if (candidate.indexOf(keywords[i]) === -1) {
            break;
          }
          matches++;
        }
        return matches === keywords.length;
    }
    return candidate.indexOf(this.query) === 0;
};

/**
 * Sets the value of the input
 *
 * @param {string|Object} value
 */
TypeAhead.prototype.value = function (value) {
    this.selected = value;
    this.element.value = this.getItemValue(value);

    if (document.createEvent) {
        var e = document.createEvent('HTMLEvents');
        e.initEvent('change', true, false);
        this.element.dispatchEvent(e);
    } else {
        this.element.fireEvent('onchange');
    }

    this.callback(value);
};

/**
 * Gets the candidates
 *
 * @param {function} callback
 */
TypeAhead.prototype.getCandidates = function (callback) {
    var items = [];
    for (var i = 0; i < this.candidates.length; i++) {
        var candidate = this.getItemValue(this.candidates[i]);
        if (this.match(this.filter(candidate))) {
            items.push(this.candidates[i]);
        }
    }
    callback(items);
};

/**
 * Extracts the item value, override this method to support array of objects
 *
 * @param {string} item
 * @return {string}
 */
TypeAhead.prototype.getItemValue = function (item) {
    return item;
};

/**
 * Highlights the item
 *
 * @param {string} item
 */
TypeAhead.prototype.highlight = function (item) {
  var str = this.getItemValue(item);
  if (!item || !this.query || this.query.length < 3) {
    text(str);
    return;
  }
  var keywords = this.query.split(/\s+/)
    // filter out duplicates
    .filter(function (value, index, self) {
      return self.indexOf(value) === index;
    })
    .filter(function (kw) {
      return kw.length > 1;
    })
    .map(function (s) {
      return s.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
    });
  str = str.split(new RegExp('(' + keywords.join('|') + ')', 'gi'));
  for (var i = 0, l = str.length; i < l; i++) {
    if (i % 2 === 1) {
      elementOpen('strong');
      text(str[i]);
      elementClose('strong');
    } else {
      text(str[i]);
    }
  }
};

/**
 * TypeAheadList
 *
 * @constructor
 * @param {TypeAhead} typeAhead
 */
var TypeAheadList = function (typeAhead) {
    var typeAheadList = this;

    typeAheadList.typeAhead = typeAhead;

    typeAheadList.items = [];

    typeAheadList.active = 0;

    typeAheadList.element = document.createElement('ul');

    typeAhead.element.parentNode.insertBefore(typeAheadList.element, typeAhead.element.nextSibling);

    return typeAheadList;
};

/**
 * Shows the list
 */
TypeAheadList.prototype.show = function () {
    this.element.style.display = 'block';
};

/**
 * Hides the list
 */
TypeAheadList.prototype.hide = function () {
    this.element.style.display = 'none';
};

/**
 * Adds an item to the list
 *
 * @param {string|Object} item
 */
TypeAheadList.prototype.add = function (item) {
    this.items.push(item);
};

/**
 * Clears the list
 */
TypeAheadList.prototype.clear = function () {
    this.items = [];
    this.active = 0;
};

/**
 * Whether the list is empty or not
 *
 * @return {Boolean}
 */
TypeAheadList.prototype.isEmpty = function () {
    return this.element.children.length === 0;
};

/**
 * Renders the list
 */
TypeAheadList.prototype.draw = function () {
    var typeAheadList = this;
    patch(this.element, function () {
        for (var i = 0; i < typeAheadList.items.length; i++) {
            typeAheadList.drawItem(typeAheadList.items[i], typeAheadList.active === i, i);
        }
    });

    if (this.typeAhead.scrollable) {
        this.scroll();
    }

    if (this.items.length === 0) {
        this.hide();
    } else {
        this.show();
    }
};

/**
 * Renders a list item
 *
 * @param {string|Object} item
 * @param {Boolean} active
 */
TypeAheadList.prototype.drawItem = function (item, active, index) {
    var className = active ? ['class', 'active'] : null;
    var li = elementOpen.apply(null, ['li', index, null].concat(className));
    elementOpen('a');
    this.typeAhead.highlight(item);
    elementClose('a');
    elementClose('li');

    var typeAheadList = this;
    li.onmousedown = function () {
        typeAheadList.handleMouseDown.call(typeAheadList, item);
    };
};

/**
 * Mouse down event handler
 *
 * @param {string|Object} item
 */
TypeAheadList.prototype.handleMouseDown = function (item) {
    this.typeAhead.value(item);
    this.typeAhead.onMouseDown(item);
    this.clear();
    this.draw();
};

/**
 * Move the active flag to the specified index
 */
TypeAheadList.prototype.move = function (index) {
    this.active = index;
    this.draw();
};

/**
 * Move the active flag to the previous item
 */
TypeAheadList.prototype.previous = function () {
    this.move(this.active === 0 ? this.items.length - 1 : this.active - 1);
};

/**
 * Move the active flag to the next item
 */
TypeAheadList.prototype.next = function () {
    this.move(this.active === this.items.length - 1 ? 0 : this.active + 1);
};

/**
 * Adjust the scroll position to keep the active item into the visible area of the list
 */
TypeAheadList.prototype.scroll = function () {
  if (this.isEmpty()) {
      return;
  }

  var item = this.element.children[this.active],
      list = this.element;

  if (item.offsetTop + item.offsetHeight >= list.scrollTop + list.offsetHeight) {
      list.scrollTop = item.offsetTop + item.offsetHeight - list.offsetHeight;
      return;
  }

  if (item.offsetTop < list.scrollTop) {
      list.scrollTop = item.offsetTop;
  }
};

/**
 * Export TypeAhead for Browserify
 */
module.exports = TypeAhead
