/**
 * Analytics Service
 * 
 * Handles client-side analytics tracking and reporting
 */

class AnalyticsService {
  constructor() {
    this.enabled = false;
    this.debugMode = false;
    this.anonymizeIps = true;
    this.userId = null;
    this.sessionId = null;
    this.providerInitialized = {
      internal: false,
      googleAnalytics: false,
      mixpanel: false
    };
    this.providers = [];
    this.queue = [];
    this.internalEvents = [];
    this.MAX_INTERNAL_EVENTS = 500;
  }
  
  /**
   * Initialize the analytics service
   */
  async initialize(options = {}) {
    // Set options
    this.enabled = options.enabled !== undefined ? options.enabled : true;
    this.debugMode = options.debug || false;
    this.anonymizeIps = options.anonymizeIps !== undefined ? options.anonymizeIps : true;
    this.providers = options.providers || ['internal'];
    
    // Generate session ID if not exists
    if (!this.sessionId) {
      this.sessionId = this.generateId();
      sessionStorage.setItem('analytics_session_id', this.sessionId);
    }
    
    if (!this.enabled) {
      this.log('Analytics tracking is disabled');
      return false;
    }
    
    try {
      // Initialize each provider
      for (const provider of this.providers) {
        await this.initializeProvider(provider);
      }
      
      // Process queued events
      this.processQueue();
      
      // Track initialization
      this.trackEvent('analytics_initialized', {
        providers: this.providers,
        timestamp: new Date().toISOString()
      });
      
      this.log('Analytics service initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize analytics service:', error);
      return false;
    }
  }
  
  /**
   * Initialize specific provider
   */
  async initializeProvider(provider) {
    switch (provider.toLowerCase()) {
      case 'internal':
        this.providerInitialized.internal = true;
        break;
        
      case 'googleanalytics':
      case 'ga':
        await this.initializeGoogleAnalytics();
        break;
        
      case 'mixpanel':
        await this.initializeMixpanel();
        break;
        
      default:
        this.log(`Unknown analytics provider: ${provider}`);
    }
  }
  
  /**
   * Initialize Google Analytics
   */
  async initializeGoogleAnalytics() {
    try {
      const gaId = window.GA_MEASUREMENT_ID;
      
      if (!gaId) {
        throw new Error('Google Analytics Measurement ID not found');
      }
      
      // Check if GA script already loaded
      if (window.gtag) {
        this.providerInitialized.googleAnalytics = true;
        return true;
      }
      
      // Load GA script
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
      
      // Initialize gtag
      window.dataLayer = window.dataLayer || [];
      window.gtag = function() {
        window.dataLayer.push(arguments);
      };
      window.gtag('js', new Date());
      window.gtag('config', gaId, {
        anonymize_ip: this.anonymizeIps,
        send_page_view: false
      });
      
      // Append script to document
      document.head.appendChild(script);
      
      // Mark as initialized
      this.providerInitialized.googleAnalytics = true;
      this.log('Google Analytics initialized');
      
      return true;
    } catch (error) {
      console.error('Failed to initialize Google Analytics:', error);
      this.providerInitialized.googleAnalytics = false;
      return false;
    }
  }
  
  /**
   * Initialize Mixpanel
   */
  async initializeMixpanel() {
    try {
      const mixpanelId = window.MIXPANEL_TOKEN;
      
      if (!mixpanelId) {
        throw new Error('Mixpanel token not found');
      }
      
      // Check if Mixpanel already loaded
      if (window.mixpanel && window.mixpanel.init) {
        this.providerInitialized.mixpanel = true;
        return true;
      }
      
      // Load Mixpanel script
      (function(c,a){if(!a.__SV){var b=window;try{var d,m,j,k=b.location,f=k.hash;d=function(a,b){return(m=a.match(RegExp(b+"=([^&]*)")))?m[1]:null};f&&d(f,"state")&&(j=JSON.parse(decodeURIComponent(d(f,"state"))),"mpeditor"===j.action&&(b.sessionStorage.setItem("_mpcehash",f),history.replaceState(j.desiredHash||"",c.title,k.pathname+k.search)))}catch(n){}var l,h;window.mixpanel=a;a._i=[];a.init=function(b,d,g){function c(b,i){var a=i.split(".");2==a.length&&(b=b[a[0]],i=a[1]);b[i]=function(){b.push([i].concat(Array.prototype.slice.call(arguments,0)))}}var e=a;"undefined"!==typeof g?e=a[g]=[]:g="mixpanel";e.people=e.people||[];e.toString=function(b){var a="mixpanel";"mixpanel"!==g&&(a+="."+g);b||(a+=" (stub)");return a};e.people.toString=function(){return e.toString(1)+".people (stub)"};l="disable time_event track track_pageview track_links track_forms track_with_groups add_group set_group remove_group register register_once alias unregister identify name_tag set_config reset opt_in_tracking opt_out_tracking has_opted_in_tracking has_opted_out_tracking clear_opt_in_out_tracking start_batch_senders people.set people.set_once people.unset people.increment people.append people.union people.track_charge people.clear_charges people.delete_user people.remove".split(" ");
      for(h=0;h<l.length;h++)c(e,l[h]);var f="set set_once union unset remove delete".split(" ");e.get_group=function(){function a(c){b[c]=function(){call2_args=arguments;call2=[c].concat(Array.prototype.slice.call(call2_args,0));e.push([d,call2])}}for(var b={},d=["get_group"].concat(Array.prototype.slice.call(arguments,0)),c=0;c<f.length;c++)a(f[c]);return b};a._i.push([b,d,g])};a.__SV=1.2;b=c.createElement("script");b.type="text/javascript";b.async=!0;b.src="undefined"!==typeof MIXPANEL_CUSTOM_LIB_URL?
      MIXPANEL_CUSTOM_LIB_URL:"file:"===c.location.protocol&&"//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js".match(/^\/\//)?"https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js":"//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js";d=c.getElementsByTagName("script")[0];d.parentNode.insertBefore(b,d)}})(document,window.mixpanel||[]);
      
      // Initialize Mixpanel
      window.mixpanel.init(mixpanelId, {
        track_pageview: false,
        ip: !this.anonymizeIps
      });
      
      // Mark as initialized
      this.providerInitialized.mixpanel = true;
      this.log('Mixpanel initialized');
      
      return true;
    } catch (error) {
      console.error('Failed to initialize Mixpanel:', error);
      this.providerInitialized.mixpanel = false;
      return false;
    }
  }
  
  /**
   * Set user ID for tracking
   */
  setUserId(userId) {
    this.userId = userId;
    
    // Set user ID in providers
    if (this.providerInitialized.googleAnalytics && window.gtag) {
      window.gtag('set', { user_id: userId });
    }
    
    if (this.providerInitialized.mixpanel && window.mixpanel) {
      window.mixpanel.identify(userId);
    }
    
    return true;
  }
  
  /**
   * Track event with all initialized providers
   */
  trackEvent(eventName, properties = {}) {
    if (!this.enabled) return false;
    
    // Add common properties
    const eventProperties = {
      ...properties,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      path: window.location.pathname
    };
    
    // Add user ID if available
    if (this.userId) {
      eventProperties.userId = this.userId;
    }
    
    // If providers not yet initialized, queue the event
    if (!this.isAnyProviderInitialized()) {
      this.queueEvent(eventName, eventProperties);
      return false;
    }
    
    // Track with each provider
    if (this.providerInitialized.internal) {
      this.trackEventInternal(eventName, eventProperties);
    }
    
    if (this.providerInitialized.googleAnalytics && window.gtag) {
      this.trackEventGA(eventName, eventProperties);
    }
    
    if (this.providerInitialized.mixpanel && window.mixpanel) {
      this.trackEventMixpanel(eventName, eventProperties);
    }
    
    this.log(`Tracked event: ${eventName}`, eventProperties);
    return true;
  }
  
  /**
   * Track page view
   */
  trackPageView(path, title) {
    const currentPath = path || window.location.pathname;
    const pageTitle = title || document.title;
    
    return this.trackEvent('page_view', {
      path: currentPath,
      title: pageTitle,
      referrer: document.referrer
    });
  }
  
  /**
   * Track event with internal provider
   */
  trackEventInternal(eventName, properties) {
    // Add to internal events array with timestamp
    this.internalEvents.push({
      name: eventName,
      properties,
      timestamp: new Date()
    });
    
    // Limit size of internal events array
    if (this.internalEvents.length > this.MAX_INTERNAL_EVENTS) {
      this.internalEvents.shift();
    }
  }
  
  /**
   * Track event with Google Analytics
   */
  trackEventGA(eventName, properties) {
    if (!window.gtag) return;
    
    // Copy properties and remove reserved keys
    const gaProperties = { ...properties };
    delete gaProperties.sessionId;
    delete gaProperties.timestamp;
    
    // Send event to GA
    window.gtag('event', eventName, gaProperties);
  }
  
  /**
   * Track event with Mixpanel
   */
  trackEventMixpanel(eventName, properties) {
    if (!window.mixpanel) return;
    
    // Send event to Mixpanel
    window.mixpanel.track(eventName, properties);
  }
  
  /**
   * Queue event for later processing
   */
  queueEvent(eventName, properties) {
    this.queue.push({
      name: eventName,
      properties,
      timestamp: new Date()
    });
    
    this.log(`Queued event: ${eventName}`);
  }
  
  /**
   * Process queued events
   */
  processQueue() {
    if (this.queue.length === 0) return;
    
    this.log(`Processing ${this.queue.length} queued events`);
    
    this.queue.forEach(event => {
      this.trackEvent(event.name, event.properties);
    });
    
    // Clear queue
    this.queue = [];
  }
  
  /**
   * Check if any provider is initialized
   */
  isAnyProviderInitialized() {
    return this.providerInitialized.internal ||
           this.providerInitialized.googleAnalytics ||
           this.providerInitialized.mixpanel;
  }
  
  /**
   * Get analytics data for internal tracking
   */
  getInternalAnalytics() {
    // Count events by name
    const eventCounts = {};
    this.internalEvents.forEach(event => {
      eventCounts[event.name] = (eventCounts[event.name] || 0) + 1;
    });
    
    // Get top events
    const topEvents = Object.entries(eventCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
    
    // Get recent events
    const recentEvents = this.internalEvents
      .slice(-10)
      .reverse()
      .map(event => ({
        name: event.name,
        timestamp: event.timestamp,
        properties: event.properties
      }));
    
    return {
      enabled: this.enabled,
      providers: Object.entries(this.providerInitialized)
        .filter(([_, initialized]) => initialized)
        .map(([name]) => name),
      eventCount: this.internalEvents.length,
      topEvents,
      recentEvents
    };
  }
  
  /**
   * Clear internal analytics data
   */
  clearInternalAnalytics() {
    this.internalEvents = [];
    return true;
  }
  
  /**
   * Generate unique ID
   */
  generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  /**
   * Log debug message
   */
  log(message, data) {
    if (this.debugMode) {
      if (data) {
        console.log(`[Analytics] ${message}`, data);
      } else {
        console.log(`[Analytics] ${message}`);
      }
    }
  }
}

// Create singleton instance
const Analytics = new AnalyticsService();

// Auto-initialize if global config is available
if (typeof window !== 'undefined' && window.ANALYTICS_CONFIG) {
  Analytics.initialize(window.ANALYTICS_CONFIG);
}

export default Analytics; 