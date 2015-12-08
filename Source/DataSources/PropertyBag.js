/*global define*/
define([
        '../Core/defaultValue',
        '../Core/defined',
        '../Core/defineProperties',
        '../Core/DeveloperError',
        '../Core/Event',
        './createPropertyDescriptor',
        './Property'
    ], function(
        defaultValue,
        defined,
        defineProperties,
        DeveloperError,
        Event,
        createPropertyDescriptor,
        Property) {
    "use strict";

    /**
     * A {@link Property} whose value is a key-value mapping of property names to the computed value of other properties.
     *
     * @alias PropertyBag
     * @constructor
     *
     * @param {Object} [value] An object, containing key-value mapping of property names to properties.
     * @param {Function} [createPropertyCallback] A function that will be called when the value of any of the properties in value are not a Property.
     */
    var PropertyBag = function(value, createPropertyCallback) {
        this._propertyNames = [];
        this._definitionChanged = new Event();

        if (defined(value)) {
            this.merge(value, createPropertyCallback);
        }
    };

    defineProperties(PropertyBag.prototype, {
        /**
         * Gets the names of all properties registered on this instance.
         * @memberof PropertyBag.prototype
         * @type {Array}
         */
        propertyNames : {
            get : function() {
                return this._propertyNames;
            }
        },
        /**
         * Gets a value indicating if this property is constant.  This property
         * is considered constant if all property items in this object are constant.
         * @memberof PropertyBag.prototype
         *
         * @type {Boolean}
         * @readonly
         */
        isConstant : {
            get : function() {
                var propertyNames = this._propertyNames;
                for (var i = 0, len = propertyNames.length; i < len; i++) {
                    if (!Property.isConstant(this[propertyNames[i]])) {
                        return false;
                    }
                }
                return true;
            }
        },
        /**
         * Gets the event that is raised whenever the set of properties contained in this
         * object changes, or one of the properties itself changes.
         *
         * @memberof PropertyBag.prototype
         *
         * @type {Event}
         * @readonly
         */
        definitionChanged : {
            get : function() {
                return this._definitionChanged;
            }
        }
    });

    /**
     * Determines if this object has defined a property with the given name.
     *
     * @param {String} propertyName The name of the property to check for.
     *
     * @returns {Boolean} True if this object has defined a property with the given name, false otherwise.
     */
    PropertyBag.prototype.hasProperty = function(propertyName) {
        return this._propertyNames.indexOf(propertyName) !== -1;
    };

    function createRawProperty(value) {
        return value;
    }

    /**
     * Adds a property to this object.
     *
     * @param {String} propertyName The name of the property to add.
     * @param {Any} [value] The value of the new property, if provided.
     * @param {Function} [createPropertyCallback] A function that will be called when the value of this new property is set to a value that is not a Property.
     *
     * @exception {DeveloperError} "propertyName" is already a registered property.
     */
    PropertyBag.prototype.addProperty = function(propertyName, value, createPropertyCallback) {
        var propertyNames = this._propertyNames;

        //>>includeStart('debug', pragmas.debug);
        if (!defined(propertyName)) {
            throw new DeveloperError('propertyName is required.');
        }
        if (propertyNames.indexOf(propertyName) !== -1) {
            throw new DeveloperError(propertyName + ' is already a registered property.');
        }
        //>>includeEnd('debug');

        propertyNames.push(propertyName);
        Object.defineProperty(this, propertyName, createPropertyDescriptor(propertyName, true, defaultValue(createPropertyCallback, createRawProperty)));

        if (defined(value)) {
            this[propertyName] = value;
        }

        this._definitionChanged.raiseEvent(this);
    };

    /**
     * Removed a property previously added with addProperty.
     *
     * @param {String} propertyName The name of the property to remove.
     *
     * @exception {DeveloperError} "propertyName" is not a registered property.
     */
    PropertyBag.prototype.removeProperty = function(propertyName) {
        var propertyNames = this._propertyNames;
        var index = propertyNames.indexOf(propertyName);

        //>>includeStart('debug', pragmas.debug);
        if (!defined(propertyName)) {
            throw new DeveloperError('propertyName is required.');
        }
        if (index === -1) {
            throw new DeveloperError(propertyName + ' is not a registered property.');
        }
        //>>includeEnd('debug');

        this._propertyNames.splice(index, 1);
        delete this[propertyName];

        this._definitionChanged.raiseEvent(this);
    };

    /**
     * Gets the value of this object.  Each contained property will be evaluated at the given time, and the overall
     * result will be an object mapping property names to those values.
     *
     * @param {JulianDate} time The time for which to retrieve the value.
     * @returns {Object} An object mapping property names to the evaluated value of those properties.
     */
    PropertyBag.prototype.getValue = function(time) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(time)) {
            throw new DeveloperError('time is required.');
        }
        //>>includeEnd('debug');

        var result = {};
        var propertyNames = this._propertyNames;
        for (var i = 0, len = propertyNames.length; i < len; i++) {
            var propertyName = propertyNames[i];
            result[propertyName] = Property.getValueOrUndefined(this[propertyName], time);
        }
        return result;
    };

    /**
     * Assigns each unassigned property on this object to the value
     * of the same property on the provided source object.
     *
     * @param {Object} source The object to be merged into this object.
     * @param {Function} [createPropertyCallback] A function that will be called when the value of any of the properties in value are not a Property.
     */
    PropertyBag.prototype.merge = function(source, createPropertyCallback) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(source)) {
            throw new DeveloperError('source is required.');
        }
        //>>includeEnd('debug');

        var propertyNames = this._propertyNames;
        var sourcePropertyNames = defined(source._propertyNames) ? source._propertyNames : Object.keys(source);
        for (var i = 0, len = sourcePropertyNames.length; i < len; i++) {
            var name = sourcePropertyNames[i];

            var targetProperty = this[name];
            var sourceProperty = source[name];

            //Custom properties that are registered on the source must also be added to this.
            if (!defined(targetProperty) && propertyNames.indexOf(name) === -1) {
                this.addProperty(name, undefined, createPropertyCallback);
            }

            if (defined(sourceProperty)) {
                if (defined(targetProperty)) {
                    if (defined(targetProperty.merge)) {
                        targetProperty.merge(sourceProperty);
                    }
                } else if (defined(sourceProperty.merge) && defined(sourceProperty.clone)) {
                    this[name] = sourceProperty.clone();
                } else {
                    this[name] = sourceProperty;
                }
            }
        }
    };

    function propertiesEqual(a, b) {
        var aPropertyNames = a._propertyNames;
        var bPropertyNames = b._propertyNames;

        var len = aPropertyNames.length;
        if (len !== bPropertyNames.length) {
            return false;
        }

        for (var aIndex = 0; aIndex < len; ++aIndex) {
            var name = aPropertyNames[aIndex];
            var bIndex = bPropertyNames.indexOf(name);
            if (bIndex === -1) {
                return false;
            }
            if (!Property.equals(a[name], b[name])) {
                return false;
            }
        }
        return true;
    }

    /**
     * Compares this property to the provided property and returns
     * <code>true</code> if they are equal, <code>false</code> otherwise.
     *
     * @param {Property} [other] The other property.
     * @returns {Boolean} <code>true</code> if left and right are equal, <code>false</code> otherwise.
     */
    PropertyBag.prototype.equals = function(other) {
        return this === other || //
               (other instanceof PropertyBag && //
                propertiesEqual(this, other));
    };

    return PropertyBag;
});
