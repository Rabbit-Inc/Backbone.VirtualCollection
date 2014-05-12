
// internal data structure is compatible with
// Backbone.Collection ...
// mind = blown

var VirtualCollection = Backbone.Collection.extend({

  constructor: function (collection, options) {
    options = options || {};
    this.collection = collection;

    if (options.comparator) this.comparator = options.comparator;
    if (options.close_with) this.closeWith(options.close_with);
    if (!this.model) this.model = collection.model;

    this.accepts = VirtualCollection.buildFilter(options.filter);
    this._rebuildIndex();
    this.listenTo(this.collection, 'add', this._onAdd);
    this.listenTo(this.collection, 'remove', this._onRemove);
    this.listenTo(this.collection, 'change', this._onChange);
    this.listenTo(this.collection, 'reset',  this._onReset);
    this.listenTo(this.collection, 'sort',  this._onSort);

    this.initialize.apply(this, arguments);
  },

  // marionette specific
  closeWith: function (view) {
    view.on('close', _.bind(this.stopListening, this));
  },

  updateFilter: function (filter) {
    this.accepts = VirtualCollection.buildFilter(filter);
    this._rebuildIndex();
    this.trigger('filter', this, filter);
    this.trigger('reset', this, filter);
    return this;
  },

  _rebuildIndex: function () {
    this._reset();
    this.collection.each(function (model, i) {
      if (this.accepts(model, i)) {
        this.models.push(model);
        this._byId[model.cid] = model;
        if (model.id) this._byId[model.id] = model;
      }
    }, this);
    this.length = this.models.length;

    if (this.comparator) this.sort({silent: true});
  },

  orderViaParent: function (options) {
    this.models = this.collection.filter(function (model) {
      return (this._byId[model.cid] !== undefined);
    }, this);
    if (!options.silent) {
      this.trigger('sort', this, options);
    }
  },

  _onSort: function (collection, options) {
    if (this.comparator !== undefined) return;
    this.orderViaParent(options);
  },

  _onAdd: function (model, collection, options) {
    if (this.accepts(model, options.index)) {
      this._indexAdd(model);
      this.trigger('add', model, this, options);
    }
  },

  _onRemove: function (model, collection, options) {
    if (!this.get(model)) return;

    var i = this._indexRemove(model)
    , options_clone = _.clone(options);
    options_clone.index = i;

    this.trigger('remove', model, this, options_clone);
  },

  _onChange: function (model, options) {
    var already_here = this.get(model);

    if (this.accepts(model, options.index)) {
      if (already_here) {
        this.trigger('change', model, this, options);
      } else {
        this._indexAdd(model);
        this.trigger('add', model, this, options);
      }
    } else {
      if (already_here) {
        var i = this._indexRemove(model)
        , options_clone = _.clone(options);
        options_clone.index = i;
        this.trigger('remove', model, this, options_clone);
      }
    }
  },

  _onReset: function (collection, options) {
    this._rebuildIndex();
    this.trigger('reset', this, options);
  },

  sortedIndex: function (model, value, context) {
    var iterator = _.isFunction(value) ? value : function(target) {
      return target.get(value);
    };
    return _.sortedIndex(this.models, model, iterator, context);
  },

  _indexAdd: function (model) {
    if (this.get(model)) return;
    // uses a binsearch to find the right index
    if (this.comparator) {
      var i = this.sortedIndex(model, this.comparator, this);
    } else if (this.comparator === undefined) {
      var i = this.sortedIndex(model, function (target) {
        return this.collection.indexOf(target);
      }, this);
    } else {
      var i = this.length;
    }
    this.models.splice(i, 0, model);
    this._byId[model.cid] = model;
    if (model.id) this._byId[model.id] = model;
    this.length += 1;
  },

  _indexRemove: function (model) {
    var i = this.indexOf(model);
    if (i === -1) return i;
    this.models.splice(i, 1);
    delete this._byId[model.cid];
    if (model.id) delete this._byId[model.id];
    this.length -= 1;
    return i;
  }

}, { // static props

  buildFilter: function (options) {
    if (!options) {
      return function () {
        return true;
      };
    } else if (_.isFunction(options)) {
      return options;
    } else if (options.constructor === Object) {
      return function (model) {
        return !Boolean(_(Object.keys(options)).detect(function (key) {
          return model.get(key) !== options[key];
        }));
      };
    }
  }
});

// methods that alter data should proxy to the parent collection
_.each(['add', 'remove', 'set', 'reset', 'push', 'pop', 'unshift', 'shift', 'slice', 'sync', 'fetch'], function (method_name) {
  VirtualCollection.prototype[method_name] = function () {
    return this.collection[method_name].apply(this.collection, _.toArray(arguments));
  };
});

_.extend(VirtualCollection.prototype, Backbone.Events);
