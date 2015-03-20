(function() {
	function mix(a, b) {
		for (var k in b) {
			a[k] = b[k];
		}
		return a;
	}
	var _0 = "easy-login@~0.1.3";
	var _1 = "dpapp-share@~0.1.0";
	var _2 = "dpapp@1.0.0-beta/lib/native-core.js";
	var _3 = "dpapp@1.0.0-beta/lib/patch-7.1.js";
	var _4 = "dpapp@1.0.0-beta/lib/patch-6.x.js";
	var _5 = "dpapp@1.0.0-beta/lib/patch-7.0.js";
	var _6 = "dpapp@1.0.0-beta/lib/web.js";
	var _7 = "dpapp@1.0.0-beta/lib/core.js";
	var _8 = "dpapp@1.0.0-beta/lib/queue.js";
	var _9 = "dpapp@1.0.0-beta/index.js";
	var asyncDeps = [_0, _1];
	var asyncDepsToMix = {
		"easy-login": _0,
		"dpapp-share": _1
	};
	var globalMap = asyncDepsToMix;
	define(_9, [_2, _3, _4, _5, _6], function(require, exports, module, __filename, __dirname) {
		(function(Host) {
			var Efte;
			var version;
			var userAgent = Host.navigator.userAgent;

			// Require different platform js base on userAgent.
			// Native part will inject the userAgent with string `efte`.

			function getQuery() {
				var query = location.search.slice(1);
				var ret = {};
				query.split("&").forEach(function(pair) {
					var splited = pair.split("=");
					ret[splited[0]] = splited[1];
				});
				return ret;
			}

			if (/dp\/com\.dianping/.test(userAgent)) {
				Efte = require('./lib/native-core');
				require('./lib/patch-7.1')(Efte);
			} else if (/MApi/.test(userAgent)) {
				Efte = require('./lib/native-core');
				version = navigator.userAgent.match(/MApi\s[\w\.]+\s\([\w\.\d]+\s([\d\.]+)/);
				// 目前有修改UA，而api尚未对齐的仅7.0版本
				version = version[1];
				if (version.indexOf("7.0") == 0) {
					require('./lib/patch-6.x')(Efte);
					require('./lib/patch-7.0')(Efte);
				}
			} else {
				// 更早的7.0之前的古早版本
				if (getQuery().product == "dpapp") {
					Efte = require('./lib/native-core');
					require('./lib/patch-6.x')(Efte);
				} else {
					// 认为是在web中
					Efte = require('./lib/web');
				}
			}

			// Export Efte object, if support AMD, CMD, CommonJS.
			if (typeof module !== 'undefined') {
				module.exports = Efte;
			}

			// Export Efte object to Host
			if (typeof Host !== 'undefined') {
				Host.Efte = Host.DPApp = Efte;
			}
		}(this));
	}, {
		asyncDeps: asyncDeps,
		main: true,
		map: mix({
			"./lib/native-core": _2,
			"./lib/patch-7.1": _3,
			"./lib/patch-6.x": _4,
			"./lib/patch-7.0": _5,
			"./lib/web": _6
		}, globalMap)
	});

	define(_2, [_7, _8], function(require, exports, module, __filename, __dirname) {
		var Efte = module.exports = require('./core');
		/**
		 * count from 1
		 * @type {Number}
		 */
		var callbacksCount = 1;
		/**
		 * mapping for all callbacks
		 * @type {Object}
		 */

		var queue = require('./queue');
		var q = queue(function(data) {
			Efte._doSendMessage(data.method, data.args, data.callback);
		});

		Efte.extend({
			_callbacks: [],
			_dequeueTimeout: null,
			dequeue: function() {
				clearTimeout(this._dequeueTimeout);
				this._dequeueTimeout = null;
				q.dequeue();
			},
			_sendMessage: function(method, args, callback) {
				q.push({
					method: method,
					args: args,
					callback: callback
				});
				this._dequeueTimeout = setTimeout(this.dequeue.bind(this), 1000);
			},
			/**
			 * send message to native
			 * @param  {String}   method
			 * @param  {Object}   args
			 * @param  {Function} callback
			 */
			_doSendMessage: function(method, args, callback) {
				var hasCallback = callback && typeof callback == 'function';

				/**
				 * check type for args
				 */
				if (typeof args !== 'object') {
					args = {};
				}

				args = JSON.stringify(args);

				this.log('调用方法', method + ":" + args);

				/**
				 * pass 0 as callbackId
				 * thus _callbacks[callbackId] is undefined
				 * nothing will happend
				 * @type {Number}
				 */
				var callbackId = hasCallback ? callbacksCount++ : 0;
				if (hasCallback) {
					this._callbacks[callbackId] = callback;
				}

				/**
				 * create iframe，
				 * and native will intercept and handle the process
				 */
				var ifr = document.createElement('iframe');
				ifr.style.display = 'none';
				document.body.appendChild(ifr);

				function removeIframe() {
						ifr.onload = ifr.onerror = null;
						ifr.parentNode && ifr.parentNode.removeChild(ifr);
					}
					/**
					 * remove iframe after loaded
					 */
				ifr.onload = ifr.onerror = removeIframe;
				setTimeout(removeIframe, 5000);
				ifr.src = 'js://_?method=' + method + '&args=' + encodeURIComponent(args) + '&callbackId=' + callbackId;
			},
			_send: function(method, args) {
				var self = this;
				var _success = args.success;
				var _fail = args.fail;
				var _handle = args.handle;

				var fail = function(result) {
					self.log('调用失败', result);
					_fail && _fail.call(null, result);
				}

				var success = function(result) {
					self.log('调用成功', result);
					_success && _success.call(null, result);
				}

				var handle = function(result) {
					self.log('回调', result);
					_handle && _handle.call(null, result);
				}

				var callback = (_success || _fail || _handle) ? function(result) {
					var status = result.status;
					if (result.result != "next") {
						delete result.result;
					}
					if (status == "success") {
						success && success(result);
					} else if (status == "action") {
						handle && handle(result);
					} else {
						fail && fail(result);
					}
				} : null;
				this._sendMessage(method, args, callback);
			},
			_sanitizeAjaxOpts: function(args) {
				args.method = args.method || "get";
				args.data = args.data || "";
				var url = args.url;
				var data = args.data;

				if (args.method == "get") {
					var params = [];
					for (var p in data) {
						if (data[p]) {
							params.push(p + '=' + encodeURIComponent(data[p]));
						}
					}

					if (params.length) {
						url += url.indexOf('?') == -1 ? "?" : "&";
						url += params.join('&');
					}
					args.url = url;
					delete args.data;
				}
				return args;
			},
			_transModel: function(keys, obj) {
				if (!keys) {
					return obj;
				}
				var keymap = {};

				function getHash(str) {
					hashCode = function(str) {
						var hash = 0,
							i, chr, len;
						if (str.length == 0) return hash;
						for (i = 0, len = str.length; i < len; i++) {
							chr = str.charCodeAt(i);
							hash = ((hash << 5) - hash) + chr;
							hash |= 0; // Convert to 32bit integer
						}
						return hash;
					};

					var i = hashCode(str);
					return "0x" + ((0xFFFF & i) ^ (i >>> 16)).toString(16);
				}

				function generateKeys(keys) {
					keys.forEach(function(key) {
						keyMap[getHash(key)] = key;
					});
				}

				function isArray(val) {
					return Object.prototype.toString.call(val) == "[object Array]";
				}

				function isObject(val) {
					return Object.prototype.toString.call(val) == "[object Object]";
				}

				function translate(obj) {
					if (isObject(obj)) {
						delete obj.__name;
						for (var key in obj) {
							var val;
							if (keymap[key]) {
								val = obj[keymap[key]] = obj[key];
								translate(val);
								delete obj[key];
							}
						}
					} else if (isArray(obj)) {
						obj.forEach(function(item) {
							translate(item);
						});
					}
					return obj;
				}

				keys.forEach(function(key) {
					keymap[getHash(key)] = key;
				});

				return translate(obj);
			},
			/**
			 * callback function to be invoked from native
			 * @param  {Number} callbackId
			 * @param  {Object} retValue
			 */
			callback: function(callbackId, retValue) {
				var callback = this._callbacks[callbackId];
				callback && callback(retValue);
				if (retValue.result == "complete" || retValue.result == "error") {
					this._callbacks[callbackId] = null;
					delete this._callbacks[callbackId];
				}
			},
		});
	}, {
		asyncDeps: asyncDeps,
		map: mix({
			"./core": _7,
			"./queue": _8
		}, globalMap)
	});

	define(_3, [], function(require, exports, module, __filename, __dirname) {
		module.exports = function(Efte) {
			var apis = [
				/**
				 * Infos
				 */
				"getUserInfo", "getCityId", "getLocation", "getContactList", "getCX",
				/**
				 * Common
				 */
				"getRequestId", "downloadImage", "closeWindow", /* getNetworkType, share */
				/**
				 * Funcs
				 */
				"sendSMS", "openScheme", /* ajax */
				/**
				 * Broadcast
				 */
				"publish", /* subscribe, unsubscribe, login */
				/**
				 * UI
				 */
				"setTitle", "setLLButton", "setLRButton", "setRLButton", "setRRButton"
			];

			apis.forEach(function(name) {
				Efte[name] = function(options) {
					this._send(name, options);
				}
			});

			// Efte.NetworkType = {
			//   IOS_

			// };

			Efte.ready = function(callback) {
				Efte._send("ready", {
					success: callback
				});
			};

			Efte.getNetworkType = function(opts) {
				var _success = opts.success;

				function iOSNetworkType(result) {
					var networkType;
					var types = {
						kSCNetworkReachabilityFlagsTransientConnection: 1 << 0,
						kSCNetworkReachabilityFlagsReachable: 1 << 1,
						kSCNetworkReachabilityFlagsConnectionRequired: 1 << 2,
						kSCNetworkReachabilityFlagsConnectionOnTraffic: 1 << 3,
						kSCNetworkReachabilityFlagsInterventionRequired: 1 << 4,
						kSCNetworkReachabilityFlagsConnectionOnDemand: 1 << 5,
						kSCNetworkReachabilityFlagsIsLocalAddress: 1 << 16,
						kSCNetworkReachabilityFlagsIsDirect: 1 << 17,
						kSCNetworkReachabilityFlagsIsWWAN: 1 << 18
					};
					var type = result.type;
					var subType = result.subType;

					// 2g, 3g, 4g
					function getMobileType(subType) {
						switch (subType) {
							case "CTRadioAccessTechnologyGPRS":
								;
							case "CTRadioAccessTechnologyEdge":
								;
							case "CTRadioAccessTechnologyCDMA1x":
								;
								return "2g";
							case "CTRadioAccessTechnologyLTE":
								return "4g";
								// case "CTRadioAccessTechnologyWCDMA"
								// case "CTRadioAccessTechnologyHSDPA"
								// case "CTRadioAccessTechnologyHSUPA"
								// case "CTRadioAccessTechnologyCDMA1x"
								// case "CTRadioAccessTechnologyCDMAEVDORev0"
								// case "CTRadioAccessTechnologyCDMAEVDORevA"
								// case "CTRadioAccessTechnologyCDMAEVDORevB"
								// case "CTRadioAccessTechnologyeHRPD"
								return "3g";
						}
					}

					if ((type & types.kSCNetworkReachabilityFlagsReachable) == 0) {
						return "none";
					}

					if ((type & types.kSCNetworkReachabilityFlagsConnectionRequired) == 0) {
						// if target host is reachable and no connection is required
						//  then we'll assume (for now) that your on Wi-Fi
						return "wifi";
					}


					if (
						(type & types.kSCNetworkReachabilityFlagsConnectionOnDemand) != 0 ||
						(type & types.kSCNetworkReachabilityFlagsConnectionOnTraffic) != 0
					) {
						// ... and the connection is on-demand (or on-traffic) if the
						//     calling application is using the CFSocketStream or higher APIs
						if ((type & types.kSCNetworkReachabilityFlagsInterventionRequired) == 0) {
							// ... and no [user] intervention is needed
							return "wifi";
						}
					}

					if ((type & types.kSCNetworkReachabilityFlagsIsWWAN) == types.kSCNetworkReachabilityFlagsIsWWAN) {
						// ... but WWAN connections are OK if the calling application
						//     is using the CFNetwork (CFSocketStream?) APIs.
						return getMobileType(type);
					}

					return "none";
				}

				function androidNetworkType(result) {
					var type = result.type;
					var subType = result.subType;

					if (type == 0) {
						switch (subType) {
							case 1:
							case 2:
							case 4:
							case 7:
							case 11:
								return "2g";
							case 3:
							case 5:
							case 6:
							case 8:
							case 9:
							case 10:
							case 12:
							case 14:
							case 15:
								return "3g";
							case 13:
								return "4g";
						}
					}

					if (type == 1) {
						return "wifi";
					} else {
						return "none";
					}
				}

				Efte._send("getNetworkType", {
					success: function(result) {
						var ua = Efte.getUA();
						var networkType;
						switch (ua.osName) {
							case "iphone":
								networkType = iOSNetworkType(result);
								break;
							case "android":
								networkType = androidNetworkType(result);
								break;
						}

						_success && _success({
							networkType: networkType,
							raw: {
								type: result.type,
								subType: result.subType
							}
						});
					},
					fail: opts.fail
				});
			}

			Efte.share = function(opts) {
				if (!opts.feed) {
					opts.feed = 0xff;
				} else if (opts.feed.constructor.toString().indexOf("Array") >= 0) {
					var feed = [0, 0, 0, 0, 0, 0, 0, 0];
					opts.feed.forEach(function(pos) {
						feed[7 - pos] = 1;
					});
					opts.feed = parseInt(feed.join(""), 2);
				}

				this._send("share", opts);
			}

			var _events = {};
			Efte.subscribe = function(opts) {
				var name = opts.action;
				var success = opts.success;
				var handle = opts.handle;

				if (_events[name]) {
					opts.success && opts.success();
					_events[name].push(handle);
				} else {
					Efte._send("subscribe", {
						action: name,
						success: opts.success,
						handle: function() {
							_events[name].forEach(function(func) {
								func();
							});
						}
					});
					_events[name] = [handle];
				}
			}

			Efte.unsubscribe = function(opts) {
				var name = opts.action;
				var success = opts.success;
				var handle = opts.handle;

				var index = _events[name] ? _events[name].indexOf(handle) : -1;
				if (index != -1) {
					_events[name].splice(index, 1);
					success && success();
				} else {
					Efte._send("unsubscribe", {
						action: name,
						success: success
					});
				}
			}

			Efte.pay = function(args) {
				var payType = args.payType;
				var success = args.success;
				var fail = args.fail;
				var cx = args.cx;

				function payOrder(data, callback) {
					DPApp.ajax({
						url: 'http://api.p.dianping.com/payorder.pay',
						data: data,
						keys: ["Content"],
						success: function(paymsg) {
							callback(null, paymsg);
						},
						fail: function(fail) {
							callback("fail payorder");
						}
					});
				}

				function getPaymentTool(payType) {
					var PAY_TYPE_MINIALIPAY = 1;
					var PAY_TYPE_WEIXINPAY = 7;
					var PAYMENTTOOL_ALIPAY = "5:1:null#219#0";
					var PAYMENTTOOL_WEIXINPAY = "11:1:null#217#0";
					if (payType == PAY_TYPE_WEIXINPAY) {
						paymentTool = PAYMENTTOOL_WEIXINPAY;
					} else {
						paymentTool = PAYMENTTOOL_ALIPAY;
					}
					return paymentTool;
				}

				payOrder({
					token: args.token,
					orderid: args.orderId,
					paymenttool: getPaymentTool(payType),
					cx: cx
				}, function(err, paymsg) {
					if (err) {
						return fail && fail(err);
					}

					Efte._send("pay", {
						paytype: payType,
						paycontent: paymsg.Content,
						success: function(data) {
							DPApp._log(JSON.stringify(data));
						},
						fail: function(data) {
							DPApp._log(JSON.stringify(data));
						}
					});
				});
			}

			Efte.ajax = function(args) {
				args = Efte._sanitizeAjaxOpts(args);
				var _success = args.success;
				args.success = function(e) {
					var result = JSON.parse(e.mapiResult);
					result = Efte._transModel(args.keys, result);
					_success(result);
				};

				Efte._send("mapi", args);
			};

			(function() {
				var uastr = navigator.userAgent;
				var appVersionMatch = uastr.match(/dp\/[\w\.\d]+\/([\d\.]+)/);
				appVersion = appVersionMatch && appVersionMatch[1];

				Efte.getUA = function(opt) {
					var result = {};
					var success = opt && opt.success;
					var ua = {
						platform: "dpapp",
						appName: "dianping",
						appVersion: appVersion,
						osName: Efte._osUA.name,
						osVersion: Efte._osUA.version
					};
					success && success(ua);
					return ua;
				};
			})();

			Efte.uploadImage = function(opts) {
				var success = opts.success;
				var fail = opts.fail;
				var handle = opts.handle;

				this._sendMessage("uploadImage", opts, function(result) {
					var status = result.status;
					if (status == "fail") {
						fail && fail(result);
						return;
					} else if (status == "success") {
						success && success(result);
						return;
					} else if (status == "action") {
						handle && handle(result);
					}
				});
			};


			Efte.login = function(opts) {

				function getUser(callback) {
					Efte.getUserInfo({
						success: callback
					});
				}
				getUser(function(result) {
					if (result.token) {
						opts.success && opts.success(result);
					} else {
						var handler = function() {
							getUser(function(result) {
								opts.success && opts.success(result);
							});
							Efte.unsubscribe({
								"action": "loginSuccess",
								handle: handler
							});
						};
						Efte.subscribe({
							action: "loginSuccess",
							handle: handler
						});

						Efte.openScheme({
							url: "dianping://login"
						});
					}
				});
			}

		}
	}, {
		asyncDeps: asyncDeps,
		map: globalMap
	});

	define(_4, [], function(require, exports, module, __filename, __dirname) {
		module.exports = function(efte) {
			efte.getUA = function(opt) {
				// var result = {};
				// var success = opt && opt.success;
				// var appVersion = navigator.userAgent.match(/MApi\s[\w\.]+\s\([\w\.\d]+\s([\d\.]+)/)[1];
				// var ua = {
				//   platform: "dpapp",
				//   appName: "dianping",
				//   appVersion: appVersion,
				//   osName: Efte._osUA.name,
				//   osVersion: Efte._osUA.version
				// };
				// success && success(ua);
				// return ua;
			};

			var callbackLists = {};

			function dealCallback(key, value) {
				var list = callbackLists[key];
				if (list) {
					list.forEach(function(callback) {
						callback(value);
					});
					delete callbackLists[key];
				}
			}

			efte._sendMessage = function(key, args, callback) {
				var callbacks = callbackLists[key];
				var noCallback = ["share", "actionScheme"];
				if (noCallback.indexOf(key) != -1) {
					this._doSendMessage(key, args, callback);
				} else if (!callbacks) {
					callbacks = callbackLists[key] = [callback];
					this._doSendMessage(key, args, callback);
				} else {
					callbacks.push(callback);
				}
			};

			efte.callback = function(callbackId, retValue) {
				if (retValue.dpid && retValue.cityid && retValue.network) {
					dealCallback("getEnv", retValue);
				} else if (retValue.cx) {
					dealCallback("cx", retValue);
				} else if (retValue.hashJson || (retValue.code && retValue.message)) {
					dealCallback("ajax", retValue);
				} else {
					alert("callbackId:" + callbackId);
					alert("retValue:" + JSON.stringify(retValue));
					var callback = this._callbacks[callbackId];
					callback && callback(retValue);
				}
			};

			efte._getEnv = function(callback) {
				this._sendMessage("getEnv", null, callback);
			}

			efte.getUA = function(opt) {
				var success = opt && opt.success;

				this._getEnv(function(result) {
					success && success({
						platform: "dpapp",
						appName: "dianping",
						appVersion: result.version,
						osName: Efte._osUA.name,
						osVersion: Efte._osUA.version
					});
				});
			};

			efte.getCityId = function(opt) {
				var success = opt.success;
				this._getEnv(function(result) {
					success && success({
						cityId: result.cityid
					});
				});
			}

			efte.getNetworkType = function(opt) {
				var success = opt.success;
				this._getEnv(function(result) {
					success && success({
						networkType: result.network
					});
				});
			}

			efte.getUserInfo = function(opt) {
				var success = opt.success;
				this._getEnv(function(result) {
					success && success({
						token: result.token,
						dpid: result.dpid,
						userId: result.userId
					});
				});
			}

			efte.getLocation = function(opt) {
				var success = opt.success;
				this._getEnv(function(result) {
					success && success({
						lat: result.latitude,
						lng: result.longitude
					});
				});
			}

			efte.getCX = function(opt) {
				var business = opt.business;
				var success = opt.success;
				efte._sendMessage('cx', {
					business: business
				}, success);
			};

			efte.closeWindow = function() {
				efte._sendMessage("close_web");
			};

			efte.setTitle = function(opt) {
				document.title = opt.title;
				var success = opt.success;
				var title = opt.title;
				efte._sendMessage("setTitle", {
					title: title
				}, function() {});
			};

			efte.openScheme = function(opt) {
				efte._sendMessage('actionScheme', {
					url: opt.url
				});
			};

			efte.login = function() {
				efte.openScheme({
					url: "dianping://login"
				});
			}

			efte.ajax = function(opts) {
				opts = efte._sanitizeAjaxOpts(opts);
				var success = opts.success;
				var fail = opts.fail;

				function parseJSON(data) {
					var ret = {};
					if (data && data.length > 0) {
						try {
							ret = JSON.parse(data);
						} catch (ignore) {}
					}
					return ret;
				}
				efte._sendMessage("ajax", opts, function(data) {
					if (data.code == 0) {
						var result = efte._mixin(
							parseJSON(data.responseText),
							efte._transModel(opts.keys, parseJSON(data.hashJson))
						);
						success && success(result);
					} else {
						fail && fail({
							code: data.code,
							errMsg: data.message
						});
					}
				});
			};

			efte.ready = function(callback) {
				callback();
			}

			efte.share = function(opts) {
				if (!opts.feed) {
					opts.feed = 0xff;
				} else if (opts.feed.constructor.toString().indexOf("Array") >= 0) {
					var feed = [0, 0, 0, 0, 0, 0, 0, 0];
					opts.feed.forEach(function(pos) {
						feed[7 - pos] = 1;
					});
					opts.feed = parseInt(feed.join(""), 2);
				}

				this._sendMessage("share", opts);
			}

			efte.subscribe = efte.getRequestId = efte.uploadImage = efte.getContactList = efte.unsubscribe = efte.publish = efte.setLLButton = efte.setLRButton = efte.setRLButton = efte.setRRButton = efte._notImplemented;

			efte.isStatusOK = function() {};
			efte.did_handle_callback = function() {};
		};
	}, {
		asyncDeps: asyncDeps,
		map: globalMap
	});

	define(_5, [], function(require, exports, module, __filename, __dirname) {
		module.exports = function(efte) {

			efte.getUA = function(opt) {
				var result = {};
				var success = opt && opt.success;
				var appVersion = navigator.userAgent.match(/MApi\s[\w\.]+\s\([\w\.\d]+\s([\d\.]+)/)[1];
				var ua = {
					platform: "dpapp",
					appName: "dianping",
					appVersion: appVersion,
					osName: Efte._osUA.name,
					osVersion: Efte._osUA.version
				};
				success && success(ua);
				return ua;
			}


			efte.getUA = function(opt) {
				var result = {};
				var success = opt && opt.success;
				var appVersion = navigator.userAgent.match(/MApi\s[\w\.]+\s\([\w\.\d]+\s([\d\.]+)/)[1];
				var ua = {
					platform: "dpapp",
					appName: "dianping",
					appVersion: appVersion,
					osName: Efte._osUA.name,
					osVersion: Efte._osUA.version
				};
				success && success(ua);
				return ua;
			};

			efte.uploadImage = function(opts) {
				var success = opts.success;
				var fail = opts.fail;
				var handle = opts.handle;
				efte._sendMessage("uploadImage", opts, function(result) {
					var status = result.status;
					if (status == "fail") {
						fail && fail(result);
						return;
					} else if (status == "success") {
						success && success(result);
						return;
					} else if (status == "action") {
						handle && handle(result);
					}
				});
			};
			efte.closeWindow = function() {
				this._sendMessage('close_web');
			};
		};
	}, {
		asyncDeps: asyncDeps,
		map: globalMap
	});

	define(_6, [_7], function(require, exports, module, __filename, __dirname) {
		var Efte = require('./core');
		var notImplemented = Efte._notImplemented;


		/**
		 * Common
		 * 基础功能，所有app都会用到
		 */
		Efte.extend({
			getUA: function() {
				return {
					platform: "web",
					appName: "dpapp-debugger",
					appVersion: "dpapp-debugger",
					deviceName: "dpapp-debugger",
					deviceVersion: "dpapp-debugger",
				};
			},
			ready: function(callback) {
				callback();
			},
			ajax: function(opts) {
				var METHOD_GET = "GET";
				var url = opts.url;
				var method = (opts.method || METHOD_GET).toUpperCase();
				var headers = opts.headers || {};
				var data = opts.data;
				var success = opts.success;
				var fail = opts.fail;

				xhr = new XMLHttpRequest();

				if (!url) {
					url = location.href.split("?")[0];
				}

				if (method === METHOD_GET && data) {
					url += parseQuery(data);
					data = null;
				}

				if (method !== METHOD_GET) {
					xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
				}

				function parseQuery(data) {
					var queryString = "";
					for (var key in data) {
						queryString += key + '=' + encodeURIComponent(data[key])
					}
					return queryString;
				}

				xhr.onreadystatechange = function() {
					if (xhr.readyState == 4) { // ready
						xhr.onreadystatechange = function() {};
						var result, error = false;
						if ((xhr.status >= 200 && xhr.status < 300) || xhr.status == 304) {
							result = xhr.responseText;

							try {
								result = /^\s*$/.test(result) ? null : JSON.parse(result);
							} catch (e) {
								error = e;
							}

							if (error) fail && fail('ERR_PARSE_JSON');
							else success(result);
						} else {
							fail && fail(xhr.statusText);
						}
					}
				};

				xhr.open(opts.method, url, true, opts.username, opts.password);
				for (var name in headers) {
					xhr.setRequestHeader(name, headers[name]);
				}
				xhr.send(data);
			},
			ga: function(opts) {

			},
			// ImagePicker: ImagePicker,
			uploadImage: function() {

			},
			downloadImage: notImplemented,
			closeWindow: function() {
				window.close();
			}
		});

		/**
		 * Infos
		 */
		Efte.extend({
			getLocation: function(opts) {
				var success = opts.success;
				var fail = opts.fail;
				navigator.geolocation.getCurrentPosition(function(position) {
					success && success({
						lat: position.coords.latitude,
						lng: position.coords.longitude
					});
				}, function() {
					success && success({
						lat: 0,
						lng: 0
					});
				});
			},
			// 无法完美实现就不实现
			getNetworkType: notImplemented,
			getCityId: function(opts) {
				var success = opts.success;
				success && success({
					cityId: 1
				});
			},
			getUserInfo: function(opts) {
				var success = opts.success;
				success && success({
					token: "d5d4b69be8de9e81615a9682e4ab773971004eef8f0da2db858525af9faf35cc"
				});
			},
			getContactList: notImplemented,
			getCX: notImplemented
		});

		/**
		 * Funcs
		 */
		Efte.extend({
			pay: function(opts) {
				// 找文东
			},
			share: function(opts) {
				var success = opts.success;
				var handle = opts.handle;

				var title = opts.title;
				var desc = opts.desc;
				var content = opts.content;
				var pic = opts.image;
				var url = opts.url;

				require.async("dpapp-share", function(share) {
					share.pop({
						title: title,
						desc: desc,
						content: content,
						pic: pic,
						url: url
					});
					success && success();
				});
			},
			sendSMS: notImplemented,
			login: function(opts) {
				require.async("easy-login", function(EasyLogin) {

					var elem = document.createElement('div');
					var loginButton = document.createElement('input');
					loginButton.value = "login";
					loginButton.type = "button";

					elem.appendChild(loginButton);

					document.body.appendChild(elem);

					var myLogin = EasyLogin(elem, {
						platform: "mobile", //平台， mobile or pc
						channel: "1" //找账户中心申请的渠道ID
					});

					//处理Info信息
					myLogin.on("info", function(msg) {
						console.log(msg);
					});

					//处理错误信息
					myLogin.on("error", function(msg) {
						opts.fail && opts.fail();
					});

					//处理登录成功事件
					myLogin.on("login", function() {
						opts.success && opts.success();
						//do something here
					});

					loginButton.onclick = function() {
						myLogin.login(); //触发登录
					}

				});
			}
		});

		/**
		 * UI
		 */
		Efte.extend({
			setTitle: function(opts) {
				var title = opts.title;
				if (title) {
					window.title = title;
				}
			},
			setRLButton: notImplemented,
			setRRButton: notImplemented
		});


		/**
		 * Broadcast
		 */
		var _events = {};
		Efte.extend({
			subscribe: function(opts) {
				if (!opts.action) {
					return;
				}
				var name = opts.action;
				var success = opts.success;
				var handle = opts.handle;
				if (!handle) {
					return;
				}
				if (_events[name]) {
					_events[name].push(handle);
					success && success();
				} else {
					_events[name] = [handle];
				}
			},
			unsubscribe: function(opts) {
				if (!opts.action) {
					return;
				}
				var name = opts.action;
				var success = opts.success;
				var handle = opts.handle;
				var events = _events;
				var funcs = events[name];
				if (!funcs) {
					return
				}
				if (handle) {
					var index = funcs.indexOf(handle);
					events[name] = funcs.splice(index, 1);
				} else {
					delete events[name];
				}
			},
			publish: function(opts) {
				if (!opts.action) {
					return;
				}
				var name = opts.action;
				var data = opts.data;
				var funcs = _events[name];
				funcs && funcs.forEach(function(func) {
					func(data);
				});
			}
		});

		module.exports = Efte;
	}, {
		asyncDeps: asyncDeps,
		map: mix({
			"./core": _7
		}, globalMap)
	});

	define(_7, [], function(require, exports, module, __filename, __dirname) {
		var Efte = module.exports = {
			_cfg: {
				debug: false
			},
			config: function(config) {
				this._cfg = config;
			},
			Semver: {
				eq: function(a, b) {
					return a === b;
				},
				gt: function(a, b) {
					var splitedA = a.split(".");
					var splitedB = b.split(".");
					if (+splitedA[0] > +splitedB[0]) {
						return true;
					} else {
						if (+splitedA[1] > splitedB[1]) {
							return true;
						} else {
							return splitedA[2] > splitedB[2];
						}
					}
				},
				lt: function(a, b) {
					return !this.gte(a, b);
				},
				gte: function(a, b) {
					return this.eq(a, b) || this.gt(a, b);
				},
				lte: function(a, b) {
					return this.eq(a, b) || this.lt(a, b);
				}
			},
			Share: {
				WECHAT_FRIENDS: 0,
				WECHAT_TIMELINE: 1,
				QQ: 2,
				SMS: 3,
				WEIBO: 4,
				QZONE: 5,
				EMAIL: 6,
				COPY: 7
			},
			_osUA: (function() {
				var ua = navigator.userAgent;
				var osName, osVersion;
				if (ua.match(/iPhone/)) {
					osName = "iphone";
					osVersion = ua.match(/iPhone\sOS\s([\d_]+)/i)[1].replace(/_/g, ".");
				} else if (ua.match(/Android/)) {
					osName = "android";
					osVersion = ua.match(/Android\s([\w\.]+)/)[1]
				} else {
					osName = null;
					osVersion = null;
				}
				return {
					name: osName,
					version: osVersion
				}
			})(),

			log: function(tag, message) {
				if (typeof message !== "string") {
					message = JSON.stringify(message);
				}
				console.log(tag + ":" + message);
				if (this._cfg && this._cfg.debug) {
					alert(tag + ":" + message);
				}
			},
			_mixin: function(to, from) {
				for (var key in from) {
					to[key] = from[key];
				}
				return to;
			},
			extend: function(args) {
				this._mixin(Efte, args);
			},
			_notImplemented: function notImplemented(opt) {
				opt && opt.fail && opt.fail({
					errMsg: "ERR_NOT_IMPLEMENTED"
				});
			},
			isSupport: function(funcName) {
				var api = Efte[funcName];
				return api && typeof api == "function" && api != Efte._notImplemented
			}
		};
	}, {
		asyncDeps: asyncDeps,
		map: globalMap
	});

	define(_8, [], function(require, exports, module, __filename, __dirname) {
		var queue = module.exports = function(worker) {
			var currentData = null;
			var currentCallback = null;
			var q = {
				timeout: null,
				running: false,
				tasks: [],
				push: function(data, cb) {
					var callback = cb || function(data) {}
					q.tasks.push({
						data: data,
						callback: callback
					});
					setTimeout(function() {
						q.process();
					}, 0);
				},
				dequeue: function() {
					currentCallback && currentCallback();
				},
				process: function() {
					if (q.tasks.length && !q.running) {
						var task = q.tasks.shift();
						q.running = true;
						currentCallback = function() {
							q.running = false;
							task.callback(task.data);
							q.process();
						};
						currentData = task.data;
						worker(task.data, currentCallback);
					}
				}
			}
			return q;
		};
	}, {
		asyncDeps: asyncDeps,
		map: globalMap
	});
})();