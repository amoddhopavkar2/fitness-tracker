// API Configuration
const API_BASE = '/api';

// Global state
let currentUser = null;
let authToken = localStorage.getItem('authToken');
let refreshToken = localStorage.getItem('refreshToken');
let currentMonth = new Date();
let workoutData = {};
let tokenRefreshPromise = null;
let tokenCheckInterval = null;

// Data caching system
class DataCache {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = new Map();
        this.defaultTTL = 5 * 60 * 1000; // 5 minutes
    }
    
    set(key, data, ttl = this.defaultTTL) {
        this.cache.set(key, data);
        this.cacheExpiry.set(key, Date.now() + ttl);
    }
    
    get(key) {
        const expiry = this.cacheExpiry.get(key);
        if (!expiry || Date.now() > expiry) {
            this.cache.delete(key);
            this.cacheExpiry.delete(key);
            return null;
        }
        return this.cache.get(key);
    }
    
    has(key) {
        return this.get(key) !== null;
    }
    
    delete(key) {
        this.cache.delete(key);
        this.cacheExpiry.delete(key);
    }
    
    clear() {
        this.cache.clear();
        this.cacheExpiry.clear();
    }
    
    // Invalidate cache entries that match a pattern
    invalidatePattern(pattern) {
        const regex = new RegExp(pattern);
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.delete(key);
            }
        }
    }
}

// Global cache instance
const dataCache = new DataCache();

// Exercise completion state management
class ExerciseState {
    constructor() {
        this.exercises = new Map();
        this.listeners = [];
        this.currentWorkout = null;
    }
    
    setWorkout(workout) {
        this.currentWorkout = workout;
        this.exercises.clear();
        
        if (workout && workout.exercises) {
            workout.exercises.forEach(exercise => {
                this.exercises.set(exercise.id, {
                    ...exercise,
                    completed: Boolean(exercise.completed)
                });
            });
        }
        
        this.notifyListeners();
    }
    
    updateExercise(id, completed) {
        const exercise = this.exercises.get(id);
        if (exercise) {
            exercise.completed = completed;
            exercise.completed_at = completed ? new Date().toISOString() : null;
            this.exercises.set(id, exercise);
            this.notifyListeners();
        }
    }
    
    getExercise(id) {
        return this.exercises.get(id);
    }
    
    getProgress() {
        const exercises = Array.from(this.exercises.values());
        const total = exercises.length;
        const completed = exercises.filter(ex => ex.completed).length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        return { total, completed, percentage };
    }
    
    addListener(listener) {
        this.listeners.push(listener);
    }
    
    removeListener(listener) {
        const index = this.listeners.indexOf(listener);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }
    
    notifyListeners() {
        this.listeners.forEach(listener => listener(this.exercises, this.getProgress()));
    }
}

// Global exercise state instance
const exerciseState = new ExerciseState();

// Dependency validation
function validateDependencies() {
    const requiredDependencies = {
        'Chart': 'Chart.js',
        'tailwind': 'Tailwind CSS'
    };
    
    const missingDependencies = [];
    
    // Check Chart.js
    if (typeof window.Chart === 'undefined') {
        missingDependencies.push('Chart.js');
    }
    
    // Check Tailwind CSS (check if tailwind classes are working by testing a utility)
    const testElement = document.createElement('div');
    testElement.className = 'bg-red-500';
    document.body.appendChild(testElement);
    const computedStyle = window.getComputedStyle(testElement);
    const backgroundColor = computedStyle.backgroundColor;
    document.body.removeChild(testElement);
    
    // If Tailwind is loaded, bg-red-500 should give us rgb(239, 68, 68)
    if (!backgroundColor || backgroundColor === 'rgba(0, 0, 0, 0)' || backgroundColor === 'transparent') {
        missingDependencies.push('Tailwind CSS');
    }
    
    if (missingDependencies.length > 0) {
        const errorMessage = `Missing frontend dependencies: ${missingDependencies.join(', ')}`;
        console.error(errorMessage);
        
        // Show user-friendly error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg z-50';
        errorDiv.innerHTML = `
            <div class="flex items-center">
                <span class="mr-2">⚠️</span>
                <div>
                    <div class="font-semibold">Dependencies Missing</div>
                    <div class="text-sm">${errorMessage}</div>
                </div>
            </div>
        `;
        document.body.appendChild(errorDiv);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 10000);
        
        throw new Error(errorMessage);
    }
    
    console.log('✅ All frontend dependencies loaded successfully');
    return true;
}

// DOM Elements
const authModal = document.getElementById('auth-modal');
const mainContent = document.getElementById('main-content');
const loadingScreen = document.getElementById('loading-screen');
const userInfo = document.getElementById('user-info');
const logoutButton = document.getElementById('logout-button');

// Authentication functions
async function login(username, password) {
    const loginButton = document.getElementById('login-submit-btn');
    
    try {
        // Validate input
        ErrorUtils.validateForm({ username, password }, {
            username: { 
                required: true, 
                minLength: 3,
                maxLength: 50
            },
            password: { 
                required: true, 
                minLength: 6
            }
        });
        
        const data = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
            loadingElement: loginButton
        });

        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('authToken', authToken);
        
        // Store refresh token if provided
        if (data.refreshToken) {
            refreshToken = data.refreshToken;
            localStorage.setItem('refreshToken', refreshToken);
        }
        
        hideAuthModal();
        showMainContent();
        initializeApp();
        
        ErrorHandler.showUserMessage(`Welcome back, ${currentUser.username}!`, 'success');
        return data;
    } catch (error) {
        ErrorHandler.handle(error, 'login');
        throw error;
    }
}

async function register(username, email, password) {
    const registerButton = document.getElementById('register-submit-btn');
    
    try {
        // Validate input
        ErrorUtils.validateForm({ username, email, password }, {
            username: { 
                required: true, 
                minLength: 3,
                maxLength: 50,
                pattern: /^[a-zA-Z0-9_]+$/,
                message: 'Username can only contain letters, numbers, and underscores'
            },
            email: { 
                required: true,
                pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Please enter a valid email address'
            },
            password: { 
                required: true, 
                minLength: 6,
                maxLength: 100
            }
        });
        
        await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password }),
            loadingElement: registerButton
        });

        ErrorHandler.showUserMessage('Registration successful! Logging you in...', 'success');
        
        // Auto-login after registration
        return await login(username, password);
    } catch (error) {
        ErrorHandler.handle(error, 'register');
        throw error;
    }
}

async function checkAuth() {
    if (!authToken) {
        showAuthModal();
        return false;
    }

    try {
        // Check if token is expired and try to refresh
        if (isTokenExpired(authToken)) {
            if (refreshToken) {
                try {
                    await refreshAuthToken();
                } catch (refreshError) {
                    console.log('Token refresh failed during auth check');
                    showAuthModal();
                    return false;
                }
            } else {
                console.log('Token expired and no refresh token available');
                showAuthModal();
                return false;
            }
        }
        
        const data = await apiRequest('/auth/me');
        currentUser = data.user;
        showMainContent();
        await initializeApp();
        startTokenMonitoring();
        return true;
    } catch (error) {
        // Don't show error message for auth check failures - just redirect to login
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        authToken = null;
        refreshToken = null;
        showAuthModal();
        return false;
    }
}

// Enhanced app initialization with data loading
async function initializeApp() {
    try {
        console.log('Initializing app...');
        
        // Clear any stale cache data from previous sessions
        dataCache.clear();
        
        // Load initial data in parallel
        const [workouts] = await Promise.all([
            loadWorkouts(),
            // Pre-load today's workout if available
            loadWorkoutByDay(getCurrentDay()).catch(() => null),
            // Pre-load weekly progress
            getWeeklyProgress().catch(() => null)
        ]);
        
        console.log('App initialized successfully');
        
        // Set up periodic data refresh for real-time updates
        setupPeriodicRefresh();
        
        return true;
    } catch (error) {
        console.error('Error initializing app:', error);
        ErrorHandler.handle(error, 'initializeApp');
        return false;
    }
}

// Set up periodic refresh for real-time data updates
function setupPeriodicRefresh() {
    // Refresh progress data every 2 minutes
    setInterval(async () => {
        if (currentUser && authToken) {
            try {
                await getWeeklyProgress(true);
                console.log('Periodic progress refresh completed');
            } catch (error) {
                console.log('Periodic refresh failed:', error.message);
            }
        }
    }, 2 * 60 * 1000); // 2 minutes
}

// Token monitoring functions
function startTokenMonitoring() {
    // Clear any existing interval
    if (tokenCheckInterval) {
        clearInterval(tokenCheckInterval);
    }
    
    // Check token every 5 minutes
    tokenCheckInterval = setInterval(async () => {
        if (authToken && isTokenExpired(authToken)) {
            try {
                await refreshAuthToken();
                console.log('Token automatically refreshed');
            } catch (error) {
                console.log('Automatic token refresh failed, redirecting to login');
                ErrorHandler.handleAuthError(error);
            }
        }
    }, 5 * 60 * 1000); // 5 minutes
}

function stopTokenMonitoring() {
    if (tokenCheckInterval) {
        clearInterval(tokenCheckInterval);
        tokenCheckInterval = null;
    }
}

function logout() {
    stopTokenMonitoring();
    authToken = null;
    refreshToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    hideMainContent();
    showAuthModal();
    ErrorHandler.showUserMessage('You have been logged out', 'info');
}

// Token Management Functions
function isTokenExpired(token) {
    if (!token) return true;
    
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Math.floor(Date.now() / 1000);
        // Check if token expires within the next 5 minutes
        return payload.exp < (currentTime + 300);
    } catch (error) {
        console.error('Error parsing token:', error);
        return true;
    }
}

async function refreshAuthToken() {
    // Prevent multiple simultaneous refresh attempts
    if (tokenRefreshPromise) {
        return tokenRefreshPromise;
    }
    
    if (!refreshToken) {
        throw new AuthenticationError('No refresh token available');
    }
    
    tokenRefreshPromise = (async () => {
        try {
            console.log('Refreshing authentication token...');
            
            const response = await fetch(`${API_BASE}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${refreshToken}`
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new AuthenticationError(errorData.error || 'Token refresh failed');
            }
            
            const data = await response.json();
            authToken = data.token;
            if (data.refreshToken) {
                refreshToken = data.refreshToken;
                localStorage.setItem('refreshToken', refreshToken);
            }
            localStorage.setItem('authToken', authToken);
            
            console.log('Token refreshed successfully');
            return authToken;
        } catch (error) {
            console.error('Token refresh failed:', error);
            // Clear invalid tokens
            localStorage.removeItem('authToken');
            localStorage.removeItem('refreshToken');
            authToken = null;
            refreshToken = null;
            throw error;
        } finally {
            tokenRefreshPromise = null;
        }
    })();
    
    return tokenRefreshPromise;
}

async function ensureValidToken() {
    if (!authToken) {
        throw new AuthenticationError('No authentication token');
    }
    
    if (isTokenExpired(authToken)) {
        try {
            await refreshAuthToken();
        } catch (error) {
            // If refresh fails, redirect to login
            ErrorHandler.handleAuthError(error);
            throw error;
        }
    }
    
    return authToken;
}

// UI Functions
function showAuthModal() {
    authModal.classList.add('show');
    mainContent.classList.add('hidden');
    loadingScreen.classList.add('hidden');
}

function hideAuthModal() {
    authModal.classList.remove('show');
}

function showMainContent() {
    mainContent.classList.remove('hidden');
    loadingScreen.classList.add('hidden');
    updateUserInfo();
}

function hideMainContent() {
    mainContent.classList.add('hidden');
}

function updateUserInfo() {
    if (currentUser) {
        userInfo.textContent = `Welcome, ${currentUser.username}!`;
    }
}

// Custom Error Classes
class APIError extends Error {
    constructor(message, status, endpoint) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.endpoint = endpoint;
    }
}

class NetworkError extends Error {
    constructor(message, endpoint) {
        super(message);
        this.name = 'NetworkError';
        this.endpoint = endpoint;
    }
}

class AuthenticationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AuthenticationError';
    }
}

class ValidationError extends Error {
    constructor(message, details = []) {
        super(message);
        this.name = 'ValidationError';
        this.details = details;
    }
}

class UserError extends Error {
    constructor(message, type = 'error') {
        super(message);
        this.name = 'UserError';
        this.type = type; // 'error', 'warning', 'info'
    }
}

// Error utility functions
const ErrorUtils = {
    // Wrap async functions with error handling
    wrapAsync(fn, context = '') {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                ErrorHandler.handle(error, context);
                throw error;
            }
        };
    },
    
    // Wrap regular functions with error handling
    wrap(fn, context = '') {
        return (...args) => {
            try {
                return fn(...args);
            } catch (error) {
                ErrorHandler.handle(error, context);
                throw error;
            }
        };
    },
    
    // Create a safe version of a function that won't throw
    safe(fn, defaultValue = null, context = '') {
        return (...args) => {
            try {
                return fn(...args);
            } catch (error) {
                ErrorHandler.handle(error, context);
                return defaultValue;
            }
        };
    },
    
    // Validate form data
    validateForm(formData, rules) {
        const errors = [];
        
        for (const [field, rule] of Object.entries(rules)) {
            const value = formData[field];
            
            if (rule.required && (!value || value.trim() === '')) {
                errors.push({ field, message: `${field} is required` });
                continue;
            }
            
            if (value && rule.minLength && value.length < rule.minLength) {
                errors.push({ field, message: `${field} must be at least ${rule.minLength} characters` });
            }
            
            if (value && rule.maxLength && value.length > rule.maxLength) {
                errors.push({ field, message: `${field} must be no more than ${rule.maxLength} characters` });
            }
            
            if (value && rule.pattern && !rule.pattern.test(value)) {
                errors.push({ field, message: rule.message || `${field} format is invalid` });
            }
            
            if (value && rule.custom && !rule.custom(value)) {
                errors.push({ field, message: rule.message || `${field} is invalid` });
            }
        }
        
        if (errors.length > 0) {
            throw new ValidationError('Form validation failed', errors);
        }
        
        return true;
    }
};

// Error Handler
class ErrorHandler {
    static isInitialized = false;
    static errorLog = [];
    static maxLogEntries = 100;
    
    static initialize() {
        if (this.isInitialized) return;
        
        // Global error handler for uncaught JavaScript errors
        window.addEventListener('error', (event) => {
            const error = event.error || new Error(event.message);
            this.logError(error, 'Global Error', {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
            this.handle(error, 'Global Error');
        });
        
        // Global handler for unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            const error = event.reason instanceof Error ? event.reason : new Error(event.reason);
            this.logError(error, 'Unhandled Promise Rejection');
            this.handle(error, 'Unhandled Promise Rejection');
            
            // Prevent the default browser behavior (console error)
            event.preventDefault();
        });
        
        // Handle resource loading errors (images, scripts, etc.)
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                const resourceError = new Error(`Failed to load resource: ${event.target.src || event.target.href}`);
                this.logError(resourceError, 'Resource Loading Error', {
                    element: event.target.tagName,
                    source: event.target.src || event.target.href
                });
                this.showUserMessage('Failed to load some resources. Please refresh the page.', 'warning');
            }
        }, true);
        
        this.isInitialized = true;
        console.log('✅ Global error handler initialized');
    }
    
    static logError(error, context, metadata = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            },
            context,
            metadata,
            userAgent: navigator.userAgent,
            url: window.location.href,
            userId: currentUser?.id || 'anonymous'
        };
        
        // Add to local log
        this.errorLog.unshift(logEntry);
        
        // Keep only the most recent entries
        if (this.errorLog.length > this.maxLogEntries) {
            this.errorLog = this.errorLog.slice(0, this.maxLogEntries);
        }
        
        // Log to console with structured data
        console.group(`🚨 Error Log [${context}]`);
        console.error('Error:', error);
        console.log('Context:', context);
        console.log('Metadata:', metadata);
        console.log('Timestamp:', logEntry.timestamp);
        console.groupEnd();
        
        // Send to server for monitoring (optional - only if endpoint exists)
        this.sendErrorToServer(logEntry).catch(() => {
            // Silently fail if error reporting endpoint doesn't exist
        });
    }
    
    static async sendErrorToServer(logEntry) {
        try {
            // Only send critical errors to avoid spam
            const criticalErrors = ['AuthenticationError', 'APIError', 'NetworkError'];
            if (!criticalErrors.includes(logEntry.error.name)) {
                return;
            }
            
            await fetch(`${API_BASE}/errors/report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(authToken && { 'Authorization': `Bearer ${authToken}` })
                },
                body: JSON.stringify(logEntry)
            });
        } catch (error) {
            // Silently fail - don't create error loops
        }
    }
    
    static getErrorLog() {
        return [...this.errorLog];
    }
    
    static clearErrorLog() {
        this.errorLog = [];
    }
    
    static handle(error, context = '') {
        // Log the error first
        this.logError(error, context);
        
        // Handle different error types
        if (error instanceof AuthenticationError) {
            this.handleAuthError(error);
        } else if (error instanceof APIError) {
            this.handleAPIError(error, context);
        } else if (error instanceof NetworkError) {
            this.handleNetworkError(error, context);
        } else if (error.name === 'ValidationError') {
            this.handleValidationError(error);
        } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
            this.handleNetworkError(new NetworkError(error.message, 'unknown'), context);
        } else {
            this.handleGenericError(error, context);
        }
    }
    
    static handleAPIError(error, context) {
        let message = error.message;
        
        // Provide more specific messages based on status code
        switch (error.status) {
            case 400:
                message = 'Invalid request. Please check your input and try again.';
                break;
            case 403:
                message = 'You don\'t have permission to perform this action.';
                break;
            case 404:
                message = 'The requested resource was not found.';
                break;
            case 409:
                message = 'This action conflicts with existing data.';
                break;
            case 422:
                message = 'The data provided is invalid. Please check and try again.';
                break;
            case 429:
                message = 'Too many requests. Please wait a moment and try again.';
                break;
            case 500:
                message = 'Server error. Our team has been notified.';
                break;
            case 503:
                message = 'Service temporarily unavailable. Please try again later.';
                break;
        }
        
        this.showUserMessage(message, 'error');
    }
    
    static handleNetworkError(error, context) {
        this.showRetryOption(error.endpoint, context);
    }
    
    static handleValidationError(error) {
        // Extract field-specific validation errors if available
        const message = error.details ? 
            error.details.map(detail => detail.message).join(', ') : 
            error.message;
        
        this.showUserMessage(`Validation Error: ${message}`, 'warning');
    }
    
    static handleGenericError(error, context) {
        // Provide context-specific messages when possible
        let message = 'An unexpected error occurred. Please try again.';
        
        if (context.includes('login') || context.includes('auth')) {
            message = 'Login failed. Please check your credentials and try again.';
        } else if (context.includes('workout') || context.includes('exercise')) {
            message = 'Failed to update workout data. Please try again.';
        } else if (context.includes('calendar')) {
            message = 'Failed to load calendar data. Please refresh the page.';
        } else if (context.includes('progress')) {
            message = 'Failed to load progress data. Please try again.';
        }
        
        this.showUserMessage(message, 'error');
    }
    
    static handleAuthError(error) {
        console.log('Authentication error, redirecting to login');
        stopTokenMonitoring();
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        authToken = null;
        refreshToken = null;
        currentUser = null;
        hideMainContent();
        showAuthModal();
        this.showUserMessage('Session expired. Please log in again.', 'warning');
    }
    
    static showUserMessage(message, type = 'error') {
        const colors = {
            error: 'bg-red-500',
            warning: 'bg-yellow-500',
            success: 'bg-green-500',
            info: 'bg-blue-500'
        };
        
        const icons = {
            error: '❌',
            warning: '⚠️',
            success: '✅',
            info: 'ℹ️'
        };
        
        const animationClass = type === 'success' ? 'success-message' : 'error-message';
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `fixed top-4 right-4 ${colors[type]} text-white p-3 sm:p-4 rounded-lg shadow-lg z-50 max-w-sm mx-4 ${animationClass}`;
        messageDiv.innerHTML = `
            <div class="flex items-start">
                <span class="mr-2 text-base sm:text-lg flex-shrink-0">${icons[type]}</span>
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium break-words">${message}</div>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-2 text-white hover:text-gray-200 text-lg leading-none flex-shrink-0 p-1">&times;</button>
            </div>
        `;
        
        document.body.appendChild(messageDiv);
        
        // Add touch-friendly close functionality
        messageDiv.addEventListener('touchstart', (e) => {
            if (e.target === messageDiv) {
                messageDiv.remove();
            }
        });
        
        // Auto-remove after 5 seconds (longer for success messages)
        const timeout = type === 'success' ? 3000 : 5000;
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.style.opacity = '0';
                messageDiv.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (messageDiv.parentNode) {
                        messageDiv.parentNode.removeChild(messageDiv);
                    }
                }, 300);
            }
        }, timeout);
    }
    
    static showRetryOption(endpoint, context) {
        const retryDiv = document.createElement('div');
        retryDiv.className = 'fixed top-4 right-4 bg-orange-500 text-white p-4 rounded-lg shadow-lg z-50 max-w-sm';
        retryDiv.innerHTML = `
            <div class="flex items-start">
                <span class="mr-2 text-lg">🔄</span>
                <div class="flex-1">
                    <div class="text-sm font-medium">Network Error</div>
                    <div class="text-xs mt-1">Failed to connect to server</div>
                    <button id="retry-btn" class="mt-2 bg-white text-orange-500 px-3 py-1 rounded text-xs font-medium hover:bg-gray-100">
                        Retry
                    </button>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-2 text-white hover:text-gray-200 text-lg leading-none">&times;</button>
            </div>
        `;
        
        document.body.appendChild(retryDiv);
        
        // Add retry functionality
        document.getElementById('retry-btn').addEventListener('click', () => {
            retryDiv.remove();
            // Trigger a page refresh or specific retry logic based on context
            if (context.includes('loadWorkout')) {
                loadWorkoutData();
            } else if (context.includes('calendar')) {
                loadCalendarData();
            } else if (context.includes('progress')) {
                loadProgressData();
            } else {
                location.reload();
            }
        });
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (retryDiv.parentNode) {
                retryDiv.parentNode.removeChild(retryDiv);
            }
        }, 10000);
    }
    
    static showGenericError() {
        this.showUserMessage('An unexpected error occurred. Please try again.', 'error');
    }
}

// Loading state management
class LoadingManager {
    constructor() {
        this.activeRequests = new Set();
        this.loadingElements = new Map();
    }
    
    showLoading(context, element = null) {
        this.activeRequests.add(context);
        
        if (element) {
            this.showElementLoading(element, context);
        }
        
        // Show global loading indicator if this is the first request
        if (this.activeRequests.size === 1) {
            this.showGlobalLoading();
        }
    }
    
    hideLoading(context) {
        this.activeRequests.delete(context);
        
        // Hide element-specific loading
        if (this.loadingElements.has(context)) {
            this.hideElementLoading(context);
        }
        
        // Hide global loading if no more active requests
        if (this.activeRequests.size === 0) {
            this.hideGlobalLoading();
        }
    }
    
    showElementLoading(element, context) {
        if (!element) return;
        
        // Store original content
        const originalContent = element.innerHTML;
        this.loadingElements.set(context, { element, originalContent });
        
        // Add loading class and spinner
        element.classList.add('btn-loading');
        
        // For buttons, show loading spinner
        if (element.tagName === 'BUTTON') {
            const loadingSpinner = element.querySelector('.loading');
            if (loadingSpinner) {
                loadingSpinner.classList.remove('hidden');
            }
            const textSpan = element.querySelector('[id$="-text"]');
            if (textSpan) {
                textSpan.style.opacity = '0';
            }
        }
    }
    
    hideElementLoading(context) {
        const loadingData = this.loadingElements.get(context);
        if (!loadingData) return;
        
        const { element } = loadingData;
        element.classList.remove('btn-loading');
        
        // For buttons, hide loading spinner
        if (element.tagName === 'BUTTON') {
            const loadingSpinner = element.querySelector('.loading');
            if (loadingSpinner) {
                loadingSpinner.classList.add('hidden');
            }
            const textSpan = element.querySelector('[id$="-text"]');
            if (textSpan) {
                textSpan.style.opacity = '1';
            }
        }
        
        this.loadingElements.delete(context);
    }
    
    showGlobalLoading() {
        // Add a subtle loading indicator to the page
        let globalLoader = document.getElementById('global-loader');
        if (!globalLoader) {
            globalLoader = document.createElement('div');
            globalLoader.id = 'global-loader';
            globalLoader.className = 'fixed top-0 left-0 w-full h-1 bg-cyan-500 z-50 opacity-75';
            globalLoader.style.transform = 'translateX(-100%)';
            globalLoader.style.transition = 'transform 0.3s ease';
            document.body.appendChild(globalLoader);
        }
        
        // Animate the loading bar
        setTimeout(() => {
            globalLoader.style.transform = 'translateX(0%)';
        }, 10);
    }
    
    hideGlobalLoading() {
        const globalLoader = document.getElementById('global-loader');
        if (globalLoader) {
            globalLoader.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (globalLoader.parentNode) {
                    globalLoader.parentNode.removeChild(globalLoader);
                }
            }, 300);
        }
    }
}

// Global loading manager instance
const loadingManager = new LoadingManager();

// Enhanced API Helper Functions with retry mechanism and token management
async function apiRequest(endpoint, options = {}) {
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second
    let lastError;
    
    // Skip token validation for auth endpoints
    const isAuthEndpoint = endpoint.startsWith('/auth/');
    
    // Generate unique context for this request
    const requestContext = `${options.method || 'GET'}-${endpoint}-${Date.now()}`;
    
    // Show loading state
    loadingManager.showLoading(requestContext, options.loadingElement);
    
    try {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Ensure we have a valid token for protected endpoints
                if (!isAuthEndpoint && authToken) {
                    await ensureValidToken();
                }
                
                const url = `${API_BASE}${endpoint}`;
                const config = {
                    headers: {
                        'Content-Type': 'application/json',
                        ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
                        ...options.headers
                    },
                    ...options
                };

                console.log(`API Request [${attempt}/${maxRetries}]: ${options.method || 'GET'} ${url}`);
                
                const response = await fetch(url, config);
                
                // Handle different response types
                let data;
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    data = { message: await response.text() };
                }

                if (!response.ok) {
                    // Handle specific HTTP status codes
                    if (response.status === 401) {
                        // For 401 errors, try to refresh token once if not already an auth endpoint
                        if (!isAuthEndpoint && attempt === 1 && refreshToken) {
                            try {
                                await refreshAuthToken();
                                continue; // Retry with new token
                            } catch (refreshError) {
                                throw new AuthenticationError(data.error || 'Authentication failed');
                            }
                        } else {
                            throw new AuthenticationError(data.error || 'Authentication failed');
                        }
                    } else if (response.status === 403) {
                        throw new APIError(data.error || 'Access forbidden', response.status, endpoint);
                    } else if (response.status === 404) {
                        throw new APIError(data.error || 'Resource not found', response.status, endpoint);
                    } else if (response.status >= 500) {
                        throw new APIError(data.error || 'Server error', response.status, endpoint);
                    } else {
                        throw new APIError(data.error || 'API request failed', response.status, endpoint);
                    }
                }

                console.log(`API Success: ${endpoint}`, data);
                return data;
                
            } catch (error) {
                lastError = error;
                
                // Don't retry authentication errors or client errors (4xx)
                if (error instanceof AuthenticationError || 
                    (error instanceof APIError && error.status < 500)) {
                    throw error;
                }
                
                // Don't retry on the last attempt
                if (attempt === maxRetries) {
                    break;
                }
                
                // Handle network errors and server errors (5xx) with retry
                if (error.name === 'TypeError' || error.message.includes('fetch')) {
                    console.warn(`Network error on attempt ${attempt}, retrying in ${retryDelay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
                } else if (error instanceof APIError && error.status >= 500) {
                    console.warn(`Server error ${error.status} on attempt ${attempt}, retrying in ${retryDelay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
                } else {
                    // For other errors, don't retry
                    throw error;
                }
            }
        }
        
        // If we get here, all retries failed
        if (lastError.name === 'TypeError' || lastError.message.includes('fetch')) {
            throw new NetworkError('Unable to connect to server after multiple attempts', endpoint);
        } else {
            throw lastError;
        }
    } finally {
        // Always hide loading state
        loadingManager.hideLoading(requestContext);
    }
}

// Workout Functions with caching and state management
async function loadWorkouts(forceRefresh = false) {
    const cacheKey = `workouts-${currentUser?.id}`;
    
    // Check cache first unless force refresh is requested
    if (!forceRefresh && dataCache.has(cacheKey)) {
        console.log('Loading workouts from cache');
        return dataCache.get(cacheKey);
    }
    
    try {
        console.log('Loading workouts from server');
        const data = await apiRequest('/workouts');
        const workouts = data.workouts || [];
        
        // Cache the results
        dataCache.set(cacheKey, workouts);
        
        return workouts;
    } catch (error) {
        ErrorHandler.handle(error, 'loadWorkouts');
        
        // Try to return cached data as fallback
        const cachedData = dataCache.get(cacheKey);
        if (cachedData) {
            console.log('Using cached workouts as fallback');
            return cachedData;
        }
        
        return [];
    }
}

async function loadWorkoutByDay(day, forceRefresh = false) {
    const cacheKey = `workout-${currentUser?.id}-${day}`;
    
    // Check cache first unless force refresh is requested
    if (!forceRefresh && dataCache.has(cacheKey)) {
        console.log(`Loading workout for ${day} from cache`);
        const cachedWorkout = dataCache.get(cacheKey);
        
        // Update exercise state with cached data
        exerciseState.setWorkout(cachedWorkout);
        return cachedWorkout;
    }
    
    try {
        console.log(`Loading workout for ${day} from server`);
        const data = await apiRequest(`/workouts/${day}`);
        const workout = data.workout;
        
        if (workout) {
            // Cache the workout data
            dataCache.set(cacheKey, workout);
            
            // Update exercise state
            exerciseState.setWorkout(workout);
        }
        
        return workout;
    } catch (error) {
        ErrorHandler.handle(error, 'loadWorkoutByDay');
        
        // Try to return cached data as fallback
        const cachedData = dataCache.get(cacheKey);
        if (cachedData) {
            console.log(`Using cached workout for ${day} as fallback`);
            exerciseState.setWorkout(cachedData);
            return cachedData;
        }
        
        // Clear exercise state if no data available
        exerciseState.setWorkout(null);
        return null;
    }
}

async function markExerciseComplete(exerciseId) {
    // Find the checkbox element for visual feedback
    const checkbox = document.getElementById(`exercise-${exerciseId}`);
    const taskItem = checkbox?.closest('.task-item');
    
    // Add visual feedback immediately
    if (taskItem) {
        taskItem.classList.add('completing');
        taskItem.style.opacity = '0.7';
    }
    
    // Optimistic update
    exerciseState.updateExercise(exerciseId, true);
    
    try {
        const result = await apiRequest(`/exercises/${exerciseId}/complete`, {
            method: 'PATCH'
        });
        
        // Update with server response if available
        if (result.exercise) {
            exerciseState.updateExercise(exerciseId, Boolean(result.exercise.completed));
            
            // Update cached workout data
            const currentWorkout = exerciseState.currentWorkout;
            if (currentWorkout) {
                const exerciseIndex = currentWorkout.exercises.findIndex(ex => ex.id === exerciseId);
                if (exerciseIndex !== -1) {
                    currentWorkout.exercises[exerciseIndex] = {
                        ...currentWorkout.exercises[exerciseIndex],
                        ...result.exercise,
                        completed: Boolean(result.exercise.completed)
                    };
                    
                    // Update cache with modified workout
                    const day = getCurrentDay();
                    const cacheKey = `workout-${currentUser?.id}-${day}`;
                    dataCache.set(cacheKey, currentWorkout);
                }
            }
        }
        
        // Add completion animation
        if (taskItem) {
            taskItem.classList.remove('completing');
            taskItem.classList.add('completed');
            taskItem.style.opacity = '1';
            
            // Brief success animation
            taskItem.style.transform = 'scale(1.02)';
            setTimeout(() => {
                taskItem.style.transform = 'scale(1)';
            }, 200);
        }
        
        // Show subtle success message
        ErrorHandler.showUserMessage('Great job! Exercise completed! 💪', 'success');
        
        // Invalidate related cache entries
        dataCache.invalidatePattern(`progress-.*-${currentUser?.id}`);
        dataCache.invalidatePattern(`calendar-.*-${currentUser?.id}`);
        
        // Refresh progress statistics in real-time
        await refreshProgressStats();
        
        return true;
    } catch (error) {
        // Revert optimistic update and visual state on failure
        exerciseState.updateExercise(exerciseId, false);
        if (taskItem) {
            taskItem.classList.remove('completing', 'completed');
            taskItem.style.opacity = '1';
        }
        ErrorHandler.handle(error, 'markExerciseComplete');
        return false;
    }
}

async function markExerciseIncomplete(exerciseId) {
    // Find the checkbox element for visual feedback
    const checkbox = document.getElementById(`exercise-${exerciseId}`);
    const taskItem = checkbox?.closest('.task-item');
    
    // Add visual feedback immediately
    if (taskItem) {
        taskItem.classList.remove('completed');
        taskItem.style.opacity = '0.8';
    }
    
    // Optimistic update
    exerciseState.updateExercise(exerciseId, false);
    
    try {
        const result = await apiRequest(`/exercises/${exerciseId}/incomplete`, {
            method: 'PATCH'
        });
        
        // Update with server response if available
        if (result.exercise) {
            exerciseState.updateExercise(exerciseId, Boolean(result.exercise.completed));
            
            // Update cached workout data
            const currentWorkout = exerciseState.currentWorkout;
            if (currentWorkout) {
                const exerciseIndex = currentWorkout.exercises.findIndex(ex => ex.id === exerciseId);
                if (exerciseIndex !== -1) {
                    currentWorkout.exercises[exerciseIndex] = {
                        ...currentWorkout.exercises[exerciseIndex],
                        ...result.exercise,
                        completed: Boolean(result.exercise.completed)
                    };
                    
                    // Update cache with modified workout
                    const day = getCurrentDay();
                    const cacheKey = `workout-${currentUser?.id}-${day}`;
                    dataCache.set(cacheKey, currentWorkout);
                }
            }
        }
        
        // Restore normal visual state
        if (taskItem) {
            taskItem.style.opacity = '1';
        }
        
        // Invalidate related cache entries
        dataCache.invalidatePattern(`progress-.*-${currentUser?.id}`);
        dataCache.invalidatePattern(`calendar-.*-${currentUser?.id}`);
        
        // Refresh progress statistics in real-time
        await refreshProgressStats();
        
        return true;
    } catch (error) {
        // Revert optimistic update and visual state on failure
        exerciseState.updateExercise(exerciseId, true);
        if (taskItem) {
            taskItem.classList.add('completed');
            taskItem.style.opacity = '1';
        }
        ErrorHandler.handle(error, 'markExerciseIncomplete');
        return false;
    }
}

// Helper function to get current day
function getCurrentDay() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    return dayOfWeek === 0 ? 'day7' : `day${dayOfWeek}`;
}

async function getWeeklyProgress(forceRefresh = false) {
    const cacheKey = `progress-weekly-${currentUser?.id}`;
    
    // Check cache first unless force refresh is requested
    if (!forceRefresh && dataCache.has(cacheKey)) {
        console.log('Loading weekly progress from cache');
        return dataCache.get(cacheKey);
    }
    
    try {
        console.log('Loading weekly progress from server');
        const data = await apiRequest('/workouts/progress/weekly');
        const progress = data.progress || { total: 0, completed: 0, percentage: 0 };
        
        // Cache the results with shorter TTL for progress data
        dataCache.set(cacheKey, progress, 2 * 60 * 1000); // 2 minutes
        
        return progress;
    } catch (error) {
        ErrorHandler.handle(error, 'getWeeklyProgress');
        
        // Try to return cached data as fallback
        const cachedData = dataCache.get(cacheKey);
        if (cachedData) {
            console.log('Using cached weekly progress as fallback');
            return cachedData;
        }
        
        return { total: 0, completed: 0, percentage: 0 };
    }
}

async function getDayProgress(day) {
    try {
        const data = await apiRequest(`/exercises/progress/day/${day}`);
        return data.progress || { total: 0, completed: 0, percentage: 0 };
    } catch (error) {
        ErrorHandler.handle(error, 'getDayProgress');
        return { total: 0, completed: 0, percentage: 0 };
    }
}

async function refreshProgressStats() {
    try {
        // Force refresh of all progress data
        const [weeklyProgress, streakData, monthlyStats] = await Promise.all([
            getWeeklyProgress(true),
            loadStreakData(true),
            loadMonthlyStats(true)
        ]);
        
        // Update displays
        updateProgressDisplay(weeklyProgress);
        updateSidebarProgress(weeklyProgress);
        
        // Update progress tab if visible
        const progressTab = document.querySelector('[data-tab="progress"]');
        if (progressTab && progressTab.classList.contains('active')) {
            renderProgress(streakData, monthlyStats);
        }
        
        // Also update calendar if it's visible
        const calendarTab = document.querySelector('[data-tab="calendar"]');
        if (calendarTab && calendarTab.classList.contains('active')) {
            await loadCalendarData(true);
        }
        
        return { weeklyProgress, streakData, monthlyStats };
    } catch (error) {
        console.error('Error refreshing progress stats:', error);
        return null;
    }
}

async function updateWeeklyProgress() {
    try {
        const progress = await getWeeklyProgress();
        updateProgressDisplay(progress);
        
        // Update the sidebar weekly progress display
        updateSidebarProgress(progress);
        
        // Also update calendar if it's visible
        const calendarTab = document.querySelector('[data-tab="calendar"]');
        if (calendarTab && calendarTab.classList.contains('active')) {
            await loadCalendarData();
        }
        
        return progress;
    } catch (error) {
        console.error('Error updating weekly progress:', error);
        return null;
    }
}

function updateProgressDisplay(progress) {
    // Update any progress bars or indicators on the page
    const progressBars = document.querySelectorAll('.progress-bar');
    progressBars.forEach(bar => {
        const percentage = progress.percentage || 0;
        bar.style.width = `${percentage}%`;
        
        // Update progress text if available
        const progressText = bar.parentElement.querySelector('.progress-text');
        if (progressText) {
            progressText.textContent = `${progress.completed || 0} / ${progress.total || 0}`;
        }
    });
}

function updateSidebarProgress(progress) {
    const weeklyProgressElement = document.getElementById('weekly-progress');
    if (weeklyProgressElement) {
        const workoutPercentage = progress.percentage || 0;
        const exercisePercentage = progress.exercisePercentage || 0;
        
        weeklyProgressElement.innerHTML = `
            <div class="space-y-3">
                <div class="text-center">
                    <div class="text-2xl font-bold text-cyan-600">${workoutPercentage}%</div>
                    <div class="text-sm text-slate-500">Workout Progress</div>
                    <div class="text-xs text-slate-400">${progress.completed || 0} of ${progress.total || 0} workouts</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-green-600">${exercisePercentage}%</div>
                    <div class="text-sm text-slate-500">Exercise Progress</div>
                    <div class="text-xs text-slate-400">${progress.completedExercises || 0} of ${progress.totalExercises || 0} exercises</div>
                </div>
            </div>
        `;
    }
}

// Calendar Functions

async function loadStreakData(forceRefresh = false) {
    const cacheKey = `progress-streak-${currentUser?.id}`;
    
    // Check cache first unless force refresh is requested
    if (!forceRefresh && dataCache.has(cacheKey)) {
        console.log('Loading streak data from cache');
        return dataCache.get(cacheKey);
    }
    
    try {
        console.log('Loading streak data from server');
        const data = await apiRequest('/progress/streak');
        const streakData = data || { currentStreak: 0, longestStreak: 0 };
        
        // Cache the results with shorter TTL for progress data
        dataCache.set(cacheKey, streakData, 2 * 60 * 1000); // 2 minutes
        
        return streakData;
    } catch (error) {
        ErrorHandler.handle(error, 'loadStreakData');
        
        // Try to return cached data as fallback
        const cachedData = dataCache.get(cacheKey);
        if (cachedData) {
            console.log('Using cached streak data as fallback');
            return cachedData;
        }
        
        return { currentStreak: 0, longestStreak: 0 };
    }
}

async function loadMonthlyStats(forceRefresh = false) {
    const cacheKey = `progress-monthly-${currentUser?.id}`;
    
    // Check cache first unless force refresh is requested
    if (!forceRefresh && dataCache.has(cacheKey)) {
        console.log('Loading monthly stats from cache');
        return dataCache.get(cacheKey);
    }
    
    try {
        console.log('Loading monthly stats from server');
        const data = await apiRequest('/progress/stats');
        const monthlyStats = data.currentMonth || { totalWorkouts: 0, averageCompletionRate: 0, monthName: 'This Month' };
        
        // Cache the results with shorter TTL for progress data
        dataCache.set(cacheKey, monthlyStats, 2 * 60 * 1000); // 2 minutes
        
        return monthlyStats;
    } catch (error) {
        ErrorHandler.handle(error, 'loadMonthlyStats');
        
        // Try to return cached data as fallback
        const cachedData = dataCache.get(cacheKey);
        if (cachedData) {
            console.log('Using cached monthly stats as fallback');
            return cachedData;
        }
        
        return { totalWorkouts: 0, averageCompletionRate: 0, monthName: 'This Month' };
    }
}

// UI Rendering Functions
function renderWorkout(workout) {
    if (!workout) {
        document.getElementById('workout-display').innerHTML = `
            <div class="bg-white p-8 rounded-2xl shadow-lg text-center">
                <h2 class="text-2xl font-bold text-slate-700 mb-4">No Workout Found</h2>
                <p class="text-slate-600">No workout is scheduled for this day.</p>
            </div>
        `;
        exerciseState.setWorkout(null);
        return;
    }

    // Set workout in state management
    exerciseState.setWorkout(workout);
    
    // Add listener for real-time updates
    const updateWorkoutDisplay = () => {
        const progress = exerciseState.getProgress();
        updateWorkoutProgressBar(progress);
        updateExerciseCheckboxes();
    };
    
    // Remove any existing listeners and add new one
    exerciseState.listeners = [];
    exerciseState.addListener(updateWorkoutDisplay);

    const exercises = workout.exercises || [];
    const totalExercises = exercises.length;
    const completedExercises = exercises.filter(ex => ex.completed).length;
    const progressPercentage = totalExercises > 0 ? Math.round((completedExercises / totalExercises) * 100) : 0;

    const createExerciseHtml = (exerciseList, category) => {
        if (exerciseList.length === 0) return '';
        
        return `
            <div class="mb-6">
                <h3 class="text-xl font-semibold mb-3 text-cyan-700 border-b-2 border-cyan-100 pb-2">${category}</h3>
                <div class="space-y-3">
                    ${exerciseList.map(exercise => `
                        <div class="task-item" data-exercise-id="${exercise.id}">
                            <input type="checkbox" id="exercise-${exercise.id}" class="hidden" ${exercise.completed ? 'checked' : ''}>
                            <label for="exercise-${exercise.id}" class="flex items-center cursor-pointer group">
                                <span class="task-checkbox w-6 h-6 border-2 border-slate-300 rounded-md mr-4 flex-shrink-0 relative group-hover:border-cyan-500 transition-colors"></span>
                                <span class="text-slate-700">${exercise.name}</span>
                                ${exercise.sets ? `<span class="ml-2 text-sm text-slate-500">(${exercise.sets} sets, ${exercise.reps})</span>` : ''}
                            </label>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    };

    const warmupExercises = exercises.filter(ex => ex.category === 'warmup');
    const workoutExercises = exercises.filter(ex => ex.category === 'workout');
    const cooldownExercises = exercises.filter(ex => ex.category === 'cooldown');

    document.getElementById('workout-display').innerHTML = `
        <div class="bg-white p-4 lg:p-8 rounded-2xl shadow-lg">
            <h2 class="text-2xl lg:text-3xl font-bold mb-2">${workout.title}</h2>
            <p class="text-sm lg:text-md text-slate-500 mb-6">${workout.focus}</p>
            
            <div class="mb-6" id="workout-progress-container">
                <div class="flex justify-between items-center mb-2 text-sm">
                    <span class="font-medium">Progress</span>
                    <span id="progress-text" class="font-medium text-cyan-600">${completedExercises} / ${totalExercises}</span>
                </div>
                <div class="w-full bg-slate-200 rounded-full h-3">
                    <div id="progress-bar" class="bg-gradient-to-r from-cyan-500 to-cyan-600 h-3 rounded-full transition-all duration-500 ease-out" style="width: ${progressPercentage}%"></div>
                </div>
                <div class="text-xs text-slate-500 mt-1 text-center">
                    <span id="progress-percentage">${progressPercentage}%</span> Complete
                </div>
            </div>

            ${createExerciseHtml(warmupExercises, 'Warm-Up')}
            ${createExerciseHtml(workoutExercises, 'Workout')}
            ${createExerciseHtml(cooldownExercises, 'Cool-Down')}
        </div>
    `;

    // Add event listeners to checkboxes with optimistic updates
    document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', async (e) => {
            const exerciseId = parseInt(e.target.id.replace('exercise-', ''));
            const isCompleted = e.target.checked;
            
            // Disable checkbox during API call to prevent double-clicks
            e.target.disabled = true;
            
            try {
                if (isCompleted) {
                    await markExerciseComplete(exerciseId);
                } else {
                    await markExerciseIncomplete(exerciseId);
                }
                
                // Update weekly progress in background
                updateWeeklyProgress();
            } catch (error) {
                console.error('Error updating exercise:', error);
                // The optimistic update will be reverted by the mark functions
            } finally {
                // Re-enable checkbox
                e.target.disabled = false;
            }
        });
    });
}

function updateWorkoutProgressBar(progress) {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const progressPercentage = document.getElementById('progress-percentage');
    
    if (progressBar && progressText) {
        // Animate progress bar
        progressBar.style.width = `${progress.percentage}%`;
        progressText.textContent = `${progress.completed} / ${progress.total}`;
        
        if (progressPercentage) {
            progressPercentage.textContent = `${progress.percentage}%`;
        }
        
        // Add celebration effect when workout is completed
        if (progress.percentage === 100 && progress.total > 0) {
            progressBar.classList.add('animate-pulse');
            setTimeout(() => {
                progressBar.classList.remove('animate-pulse');
                ErrorHandler.showUserMessage('🎉 Workout completed! Amazing work!', 'success');
            }, 1000);
        }
    }
    
    if (progressBar && progressText) {
        progressBar.style.width = `${progress.percentage}%`;
        progressText.textContent = `${progress.completed} / ${progress.total}`;
    }
}

function updateExerciseCheckboxes() {
    exerciseState.exercises.forEach((exercise, id) => {
        const checkbox = document.getElementById(`exercise-${id}`);
        if (checkbox) {
            checkbox.checked = exercise.completed;
            
            // Update visual state of the task item
            const taskItem = checkbox.closest('.task-item');
            if (taskItem) {
                if (exercise.completed) {
                    taskItem.classList.add('completed');
                } else {
                    taskItem.classList.remove('completed');
                }
            }
        }
    });
}

function renderCalendar(calendarData) {
    const calendarGrid = document.getElementById('calendar-grid');
    const currentMonthElement = document.getElementById('current-month');
    
    console.log('Rendering calendar with data:', calendarData);
    
    // Update current month display
    currentMonthElement.textContent = currentMonth.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long' 
    });

    // Clear previous calendar
    calendarGrid.innerHTML = '';

    // Add day headers
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    daysOfWeek.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'p-2 text-center font-semibold text-slate-600 text-sm';
        dayHeader.textContent = day;
        calendarGrid.appendChild(dayHeader);
    });

    // Add calendar days
    calendarData.forEach(day => {
        const dayElement = document.createElement('div');
        dayElement.className = `calendar-day p-2 text-center border border-slate-200 min-h-[60px] flex flex-col justify-center items-center cursor-pointer hover:bg-slate-50 transition-colors`;
        dayElement.dataset.date = day.date;
        
        // Style for days not in current month
        if (!day.isCurrentMonth) {
            dayElement.classList.add('text-slate-400', 'bg-slate-50');
        }
        
        // Highlight today
        if (day.isToday) {
            dayElement.classList.add('ring-2', 'ring-cyan-500', 'bg-cyan-50');
        }
        
        // Style based on workout progress
        if (day.progress && day.progress.total > 0) {
            dayElement.classList.add('has-workout');
            
            if (day.progress.completed === day.progress.total && day.progress.total > 0) {
                // All exercises completed
                dayElement.classList.remove('has-workout');
                dayElement.classList.add('completed', 'bg-green-100', 'border-green-300');
                if (day.isCurrentMonth) {
                    dayElement.classList.add('text-green-800');
                }
            } else if (day.progress.completed > 0) {
                // Partially completed
                dayElement.classList.add('bg-yellow-100', 'border-yellow-300');
                if (day.isCurrentMonth) {
                    dayElement.classList.add('text-yellow-800');
                }
            } else {
                // Has workout but not started
                dayElement.classList.add('bg-blue-100', 'border-blue-300');
                if (day.isCurrentMonth) {
                    dayElement.classList.add('text-blue-800');
                }
            }
        }

        // Create day content
        const dayNumber = new Date(day.date).getDate();
        let progressIndicator = '';
        
        if (day.progress && day.progress.total > 0) {
            const percentage = Math.round((day.progress.completed / day.progress.total) * 100);
            progressIndicator = `
                <div class="text-xs mt-1 font-medium">
                    ${day.progress.completed}/${day.progress.total}
                </div>
                <div class="text-xs opacity-75">
                    ${percentage}%
                </div>
            `;
        }

        dayElement.innerHTML = `
            <div class="text-sm font-bold">${dayNumber}</div>
            ${progressIndicator}
        `;

        // Add click handler for navigation
        dayElement.addEventListener('click', () => {
            if (day.isCurrentMonth) {
                if (day.progress && day.progress.total > 0) {
                    // Has workout - navigate to it
                    navigateToWorkoutFromCalendar(day.date);
                } else {
                    // No workout - show info message
                    const dateObj = new Date(day.date);
                    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    const dayName = dayNames[dateObj.getDay()];
                    ErrorHandler.showUserMessage(`No workout scheduled for ${dayName}, ${dateObj.toLocaleDateString()}`, 'info');
                }
            }
        });
        
        // Add hover effect for clickable days
        if (day.isCurrentMonth) {
            dayElement.style.cursor = 'pointer';
            if (day.progress && day.progress.total > 0) {
                dayElement.title = `Click to view ${new Date(day.date).toLocaleDateString()} workout`;
            } else {
                dayElement.title = `No workout scheduled for ${new Date(day.date).toLocaleDateString()}`;
            }
        }

        calendarGrid.appendChild(dayElement);
    });
}

function renderProgress(streakData, monthlyStats) {
    // Update streak stats
    const streakStats = document.getElementById('streak-stats');
    streakStats.innerHTML = `
        <div class="text-center">
            <div class="text-3xl font-bold text-cyan-600">${streakData.currentStreak}</div>
            <div class="text-sm text-slate-500">Current Streak</div>
        </div>
        <div class="text-center">
            <div class="text-3xl font-bold text-green-600">${streakData.longestStreak}</div>
            <div class="text-sm text-slate-500">Longest Streak</div>
        </div>
    `;

    // Update monthly stats
    const monthlyStatsElement = document.getElementById('monthly-stats');
    monthlyStatsElement.innerHTML = `
        <div class="text-center">
            <div class="text-3xl font-bold text-cyan-600">${monthlyStats.workoutDays || 0}</div>
            <div class="text-sm text-slate-500">Workout Days</div>
            <div class="text-xs text-slate-400">${monthlyStats.monthName || 'This Month'}</div>
        </div>
        <div class="text-center">
            <div class="text-3xl font-bold text-green-600">${Math.round(monthlyStats.averageCompletionRate || 0)}%</div>
            <div class="text-sm text-slate-500">Completion Rate</div>
            <div class="text-xs text-slate-400">${monthlyStats.completedExercises || 0}/${monthlyStats.totalExercises || 0} exercises</div>
        </div>
    `;
}

function renderGuide() {
    const guideContent = document.getElementById('guide-content');
    const guideData = [
        { title: "Listen to Your Body", content: "It's normal to feel some muscle soreness (DOMS) 24-48 hours after a workout. However, if you feel sharp pain, stop immediately. Rest is productive." },
        { title: "Warm-Up & Cool-Down", content: "Never skip these. A good warm-up prepares your body for exercise, reducing injury risk. A cool-down helps your body recover and improves flexibility." },
        { title: "Form Over Weight", content: "Focus on performing each exercise with the correct technique. It's better to use lighter weights with good form than heavy weights with poor form. Watch videos of the exercises if you're unsure." },
        { title: "Progressive Overload", content: "To keep making progress, you need to challenge your muscles. Gradually increase the weight, the number of reps/sets, or reduce rest time over the weeks." },
        { title: "Nutrition is Crucial", content: "This plan is for your workouts, but weight loss is significantly impacted by your diet. Focus on whole foods, lean protein, fruits, and vegetables. A calorie deficit is necessary for weight loss." },
        { title: "Hydration is Key", content: "Drink plenty of water throughout the day, especially before, during, and after your workouts. It's vital for performance and recovery." },
        { title: "Rest is Mandatory", content: "Your muscles grow and repair when you rest, not when you work out. Ensure you get 7-9 hours of sleep per night and take your rest days seriously." }
    ];

    guideContent.innerHTML = guideData.map(item => `
        <div class="border border-slate-200 rounded-lg">
            <button class="w-full p-4 text-left font-semibold flex justify-between items-center accordion-button">
                <span>${item.title}</span>
                <span class="transform transition-transform duration-300">▼</span>
            </button>
            <div class="accordion-content px-4 pb-4 text-slate-600">
                <p>${item.content}</p>
            </div>
        </div>
    `).join('');

    // Add accordion functionality
    document.querySelectorAll('.accordion-button').forEach(button => {
        button.addEventListener('click', () => {
            const content = button.nextElementSibling;
            const icon = button.querySelector('span:last-child');
            content.classList.toggle('open');
            icon.classList.toggle('rotate-180');
        });
    });
}

// Tab Management
function switchTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });

    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active', 'bg-cyan-600', 'text-white');
        button.classList.add('text-slate-600');
    });

    // Show selected tab content
    document.getElementById(`${tabName}-tab`).classList.remove('hidden');

    // Add active class to selected tab button
    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    activeButton.classList.add('active', 'bg-cyan-600', 'text-white');
    activeButton.classList.remove('text-slate-600');

    // Load tab-specific data
    switch(tabName) {
        case 'workouts':
            loadWorkoutData();
            break;
        case 'calendar':
            loadCalendarData();
            break;
        case 'progress':
            loadProgressData();
            break;
        case 'guide':
            renderGuide();
            break;
    }
}

// Data Loading Functions
async function loadWorkoutData() {
    const workouts = await loadWorkouts();
    await renderWorkoutNavigation(workouts);
    updateWeeklyProgress();
}

async function loadCalendarData(forceRefresh = false) {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    const calendarData = await loadCalendarDataFromAPI(year, month, forceRefresh);
    renderCalendar(calendarData);
    return calendarData;
}

// Navigate from calendar day to specific workout
async function navigateToWorkoutFromCalendar(date) {
    try {
        // Convert date to day key (day1 = Monday, day7 = Sunday)
        const dateObj = new Date(date);
        const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        const dayKey = dayOfWeek === 0 ? 'day7' : `day${dayOfWeek}`;
        
        console.log(`Navigating to workout for ${date}, day key: ${dayKey}, day of week: ${dayOfWeek}`);
        
        // Load and render the workout
        const workoutData = await loadWorkoutByDay(dayKey);
        if (workoutData) {
            renderWorkout(workoutData);
            
            // Update navigation to highlight the selected day
            document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
            const navButton = document.querySelector(`[data-day="${dayKey}"]`);
            if (navButton) {
                navButton.classList.add('active');
            }
            
            // Switch to workouts tab with smooth transition
            switchTab('workouts');
            
            // Scroll to top of workout display
            const workoutDisplay = document.getElementById('workout-display');
            if (workoutDisplay) {
                workoutDisplay.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            
            // Show success message with day name
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dayName = dayNames[dayOfWeek];
            ErrorHandler.showUserMessage(`Loaded ${dayName}'s workout for ${dateObj.toLocaleDateString()}`, 'success');
        } else {
            // Show info message for days without workouts
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dayName = dayNames[dayOfWeek];
            ErrorHandler.showUserMessage(`No workout scheduled for ${dayName}, ${dateObj.toLocaleDateString()}`, 'info');
        }
    } catch (error) {
        console.error('Error navigating to workout from calendar:', error);
        ErrorHandler.handle(error, 'navigateToWorkoutFromCalendar');
    }
}

async function loadCalendarDataFromAPI(year, month, forceRefresh = false) {
    const cacheKey = `calendar-${year}-${month}-${currentUser?.id}`;
    
    // Check cache first unless force refresh is requested
    if (!forceRefresh && dataCache.has(cacheKey)) {
        console.log(`Loading calendar data for ${year}-${month} from cache`);
        return dataCache.get(cacheKey);
    }
    
    try {
        console.log(`Loading calendar data for ${year}-${month} from server`);
        const data = await apiRequest(`/progress/calendar/${year}/${month}`);
        console.log('Calendar data received:', data);
        const calendarData = data.calendar || [];
        
        // Cache the calendar data with shorter TTL
        dataCache.set(cacheKey, calendarData, 3 * 60 * 1000); // 3 minutes
        
        return calendarData;
    } catch (error) {
        console.error('Calendar API error:', error);
        ErrorHandler.handle(error, 'loadCalendarData');
        
        // Try to return cached data as fallback
        const cachedData = dataCache.get(cacheKey);
        if (cachedData) {
            console.log(`Using cached calendar data for ${year}-${month} as fallback`);
            return cachedData;
        }
        
        return [];
    }
}

async function loadProgressData() {
    const [streakData, monthlyStats] = await Promise.all([
        loadStreakData(),
        loadMonthlyStats()
    ]);
    renderProgress(streakData, monthlyStats);
}

async function refreshProgressStats() {
    try {
        const [streakData, monthlyStats] = await Promise.all([
            loadStreakData(),
            loadMonthlyStats()
        ]);
        renderProgress(streakData, monthlyStats);
    } catch (error) {
        console.error('Error refreshing progress stats:', error);
        // Don't show error to user as this is a background refresh
    }
}

async function renderWorkoutNavigation(workouts) {
    const dayNavigation = document.getElementById('day-navigation');
    dayNavigation.innerHTML = '';

    const days = ['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'];
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    // Load progress for all days
    const progressPromises = days.map(day => getDayProgress(day));
    const progressResults = await Promise.all(progressPromises);

    days.forEach((day, index) => {
        const workout = workouts.find(w => w.day === day);
        const progress = progressResults[index];
        const navButton = document.createElement('button');
        navButton.className = 'nav-item w-full text-left p-4 rounded-lg hover:bg-cyan-600 hover:text-white transition-colors duration-200';
        navButton.dataset.day = day;
        
        // Add progress indicator styling
        let progressClass = '';
        if (progress.total > 0) {
            if (progress.percentage === 100) {
                progressClass = 'border-l-4 border-green-500';
            } else if (progress.percentage > 0) {
                progressClass = 'border-l-4 border-yellow-500';
            } else {
                progressClass = 'border-l-4 border-slate-300';
            }
        }
        
        navButton.className += ` ${progressClass}`;
        
        if (workout) {
            navButton.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <p class="font-semibold">${dayNames[index]}: ${workout.title}</p>
                        <p class="text-sm opacity-80">${workout.focus}</p>
                        ${workout.completed ? '<span class="text-green-500 text-sm">✓ Workout Completed</span>' : ''}
                    </div>
                    ${progress.total > 0 ? `
                        <div class="text-right ml-2">
                            <div class="text-sm font-medium">${progress.completed}/${progress.total}</div>
                            <div class="text-xs opacity-70">${progress.percentage}%</div>
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            navButton.innerHTML = `
                <p class="font-semibold">${dayNames[index]}</p>
                <p class="text-sm opacity-80">No workout scheduled</p>
            `;
        }

        navButton.addEventListener('click', async () => {
            // Prevent multiple clicks during loading
            if (navButton.classList.contains('loading')) return;
            
            document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
            navButton.classList.add('active', 'loading');
            
            // Show loading state in workout display
            document.getElementById('workout-display').innerHTML = `
                <div class="bg-white p-4 lg:p-8 rounded-2xl shadow-lg text-center">
                    <div class="loading large mx-auto mb-4"></div>
                    <h2 class="text-xl lg:text-2xl font-bold text-slate-700 mb-2">Loading Workout...</h2>
                    <p class="text-slate-600">Please wait while we load your ${dayData.title}</p>
                </div>
            `;

            try {
                const workoutData = await loadWorkoutByDay(day);
                renderWorkout(workoutData);
            } catch (error) {
                document.getElementById('workout-display').innerHTML = `
                    <div class="bg-white p-4 lg:p-8 rounded-2xl shadow-lg text-center">
                        <div class="text-red-500 text-4xl mb-4">⚠️</div>
                        <h2 class="text-xl lg:text-2xl font-bold text-slate-700 mb-2">Failed to Load Workout</h2>
                        <p class="text-slate-600 mb-4">There was an error loading your workout data.</p>
                        <button onclick="this.parentElement.parentElement.click()" class="bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700 transition-colors">
                            Try Again
                        </button>
                    </div>
                `;
            } finally {
                navButton.classList.remove('loading');
            }
        });

        dayNavigation.appendChild(navButton);
    });
}



// Initialize the application with enhanced data loading
async function initializeApp() {
    try {
        console.log('Initializing app...');
        
        // Validate dependencies first
        validateDependencies();
        
        // Clear any stale cache data from previous sessions
        dataCache.clear();
        
        // Load initial data in parallel for better performance
        const [workouts] = await Promise.all([
            loadWorkoutData(),
            // Pre-load today's workout if available
            loadWorkoutByDay(getCurrentDay()).catch(() => null),
            // Pre-load weekly progress
            getWeeklyProgress().catch(() => null)
        ]);
        
        // Initialize chart
        initializeChart();
        
        // Load first workout
        const today = new Date().getDay();
        const currentDayKey = `day${today === 0 ? 7 : today}`;
        const workout = await loadWorkoutByDay(currentDayKey);
        renderWorkout(workout);
        
        // Select current day in navigation
        const currentDayButton = document.querySelector(`[data-day="${currentDayKey}"]`);
        if (currentDayButton) {
            currentDayButton.classList.add('active');
        }
        
        // Set up enhanced page visibility and network handling
        setupPageVisibilityHandling();
        setupNetworkHandling();
        
        // Set up periodic data refresh for real-time updates
        setupPeriodicRefresh();
        
        console.log('✅ Application initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing app:', error);
        
        // Show error message to user
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-4 left-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg z-50';
        errorDiv.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center">
                    <span class="mr-2">⚠️</span>
                    <div>
                        <div class="font-semibold">Application Error</div>
                        <div class="text-sm">Failed to initialize the fitness tracker. Please refresh the page.</div>
                    </div>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" class="text-white hover:text-gray-200">×</button>
            </div>
        `;
        document.body.appendChild(errorDiv);
    }
}

// Set up periodic refresh for real-time data updates
function setupPeriodicRefresh() {
    // Refresh progress data every 2 minutes when the page is visible
    setInterval(async () => {
        if (currentUser && authToken && !document.hidden) {
            try {
                await getWeeklyProgress(true);
                console.log('Periodic progress refresh completed');
            } catch (error) {
                console.log('Periodic refresh failed:', error.message);
            }
        }
    }, 2 * 60 * 1000); // 2 minutes
}

// Enhanced page visibility handling for token refresh and data sync
function setupPageVisibilityHandling() {
    document.addEventListener('visibilitychange', async () => {
        if (!document.hidden && authToken && currentUser) {
            console.log('Page became visible, checking for updates...');
            
            // User returned to the tab, check if token needs refresh
            if (isTokenExpired(authToken) && refreshToken) {
                try {
                    await refreshAuthToken();
                    console.log('Token refreshed on page visibility change');
                } catch (error) {
                    console.log('Token refresh failed on page visibility change');
                    ErrorHandler.handleAuthError(error);
                    return;
                }
            }
            
            // Refresh critical data when page becomes visible
            try {
                await Promise.all([
                    getWeeklyProgress(true),
                    loadStreakData(true)
                ]);
                
                // If we're on the workout tab, refresh current workout
                const workoutTab = document.querySelector('[data-tab="workout"]');
                if (workoutTab && workoutTab.classList.contains('active')) {
                    const currentDay = getCurrentDay();
                    await loadWorkoutByDay(currentDay, true);
                }
                
                console.log('Data refresh on visibility change completed');
            } catch (error) {
                console.log('Data refresh on visibility change failed:', error.message);
            }
        }
    });
}

// Handle online/offline events for better data synchronization
function setupNetworkHandling() {
    window.addEventListener('online', async () => {
        console.log('Network connection restored');
        ErrorHandler.showUserMessage('Connection restored. Syncing data...', 'info');
        
        if (currentUser && authToken) {
            try {
                // Force refresh all data when coming back online
                await refreshProgressStats();
                ErrorHandler.showUserMessage('Data synchronized successfully', 'success');
            } catch (error) {
                console.error('Failed to sync data after reconnection:', error);
                ErrorHandler.showUserMessage('Failed to sync some data. Please refresh the page.', 'warning');
            }
        }
    });
    
    window.addEventListener('offline', () => {
        console.log('Network connection lost');
        ErrorHandler.showUserMessage('You are offline. Some features may not work properly.', 'warning');
    });
}

function initializeChart() {
    try {
        // Validate Chart.js is available
        if (typeof Chart === 'undefined') {
            throw new Error('Chart.js is not loaded');
        }
        
        const chartElement = document.getElementById('weeklySplitChart');
        if (!chartElement) {
            throw new Error('Chart canvas element not found');
        }
        
        const ctx = chartElement.getContext('2d');
        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Strength', 'Cardio & Core', 'Recovery & Rest'],
                datasets: [{
                    label: 'Weekly Focus',
                    data: [3, 2, 2],
                    backgroundColor: [
                        'rgb(8, 145, 178)',
                        'rgb(22, 163, 74)',
                        'rgb(245, 158, 11)'
                    ],
                    borderColor: '#ffffff',
                    borderWidth: 4,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            font: {
                                family: 'Inter',
                                size: 14
                            }
                        }
                    }
                }
            }
        });
        
        console.log('✅ Chart initialized successfully');
        return chart;
    } catch (error) {
        console.error('❌ Error initializing chart:', error);
        
        // Show fallback content if chart fails to load
        const chartContainer = document.querySelector('.chart-container');
        if (chartContainer) {
            chartContainer.innerHTML = `
                <div class="flex items-center justify-center h-full bg-slate-100 rounded-lg">
                    <div class="text-center text-slate-600">
                        <div class="text-2xl mb-2">📊</div>
                        <div class="text-sm">Chart unavailable</div>
                        <div class="text-xs mt-1">Weekly split: 3 Strength, 2 Cardio, 2 Rest</div>
                    </div>
                </div>
            `;
        }
        
        throw error;
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Initialize global error handler first
        ErrorHandler.initialize();
        
        // Validate dependencies on startup
        validateDependencies();
        
        // Check authentication on load
        checkAuth();
    } catch (error) {
        console.error('❌ Startup validation failed:', error);
        // Continue with app initialization even if dependencies fail
        // The individual functions will handle their own fallbacks
        checkAuth();
    }

    // Tab switching
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            switchTab(tabName);
        });
    });

    // Calendar navigation
    document.getElementById('prev-month').addEventListener('click', async () => {
        try {
            currentMonth.setMonth(currentMonth.getMonth() - 1);
            await loadCalendarData();
        } catch (error) {
            console.error('Error loading previous month:', error);
            ErrorHandler.handle(error, 'calendar navigation');
        }
    });

    document.getElementById('next-month').addEventListener('click', async () => {
        try {
            currentMonth.setMonth(currentMonth.getMonth() + 1);
            await loadCalendarData();
        } catch (error) {
            console.error('Error loading next month:', error);
            ErrorHandler.handle(error, 'calendar navigation');
        }
    });

    // Authentication form handling
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        
        const loginLoading = document.getElementById('login-loading');
        const loginText = document.getElementById('login-text');
        
        try {
            loginLoading.classList.remove('hidden');
            loginText.classList.add('hidden');
            await login(username, password);
        } catch (error) {
            alert(error.message);
        } finally {
            loginLoading.classList.add('hidden');
            loginText.classList.remove('hidden');
        }
    });

    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        
        const registerLoading = document.getElementById('register-loading');
        const registerText = document.getElementById('register-text');
        
        try {
            registerLoading.classList.remove('hidden');
            registerText.classList.add('hidden');
            await register(username, email, password);
        } catch (error) {
            alert(error.message);
        } finally {
            registerLoading.classList.add('hidden');
            registerText.classList.remove('hidden');
        }
    });

    // Toggle between login and register forms
    document.getElementById('toggle-auth-form').addEventListener('click', () => {
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const authTitle = document.getElementById('auth-title');
        const toggleButton = document.getElementById('toggle-auth-form');
        
        if (loginForm.classList.contains('hidden')) {
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
            authTitle.textContent = 'Login';
            toggleButton.textContent = "Don't have an account? Register";
        } else {
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
            authTitle.textContent = 'Register';
            toggleButton.textContent = 'Already have an account? Login';
        }
    });

    // Close auth modal
    document.getElementById('close-auth-button').addEventListener('click', hideAuthModal);

    // Logout
    logoutButton.addEventListener('click', logout);
}); 