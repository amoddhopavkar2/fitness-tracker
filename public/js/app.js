// API Configuration
const API_BASE = '/api';

// Global state
let currentUser = null;
let authToken = localStorage.getItem('authToken');
let currentMonth = new Date();
let workoutData = {};

// DOM Elements
const authModal = document.getElementById('auth-modal');
const mainContent = document.getElementById('main-content');
const loadingScreen = document.getElementById('loading-screen');
const userInfo = document.getElementById('user-info');
const logoutButton = document.getElementById('logout-button');

// Authentication functions
async function login(username, password) {
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }

        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('authToken', authToken);
        
        hideAuthModal();
        showMainContent();
        initializeApp();
        
        return data;
    } catch (error) {
        throw error;
    }
}

async function register(username, email, password) {
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Registration failed');
        }

        // Auto-login after registration
        return await login(username, password);
    } catch (error) {
        throw error;
    }
}

async function checkAuth() {
    if (!authToken) {
        showAuthModal();
        return false;
    }

    try {
        const response = await fetch(`${API_BASE}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!response.ok) {
            throw new Error('Invalid token');
        }

        const data = await response.json();
        currentUser = data.user;
        showMainContent();
        initializeApp();
        return true;
    } catch (error) {
        localStorage.removeItem('authToken');
        authToken = null;
        showAuthModal();
        return false;
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    hideMainContent();
    showAuthModal();
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

// API Helper Functions
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            ...options.headers
        },
        ...options
    };

    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'API request failed');
    }

    return data;
}

// Workout Functions
async function loadWorkouts() {
    try {
        const data = await apiRequest('/workouts');
        return data.workouts;
    } catch (error) {
        console.error('Error loading workouts:', error);
        return [];
    }
}

async function loadWorkoutByDay(day) {
    try {
        const data = await apiRequest(`/workouts/${day}`);
        return data.workout;
    } catch (error) {
        console.error('Error loading workout:', error);
        return null;
    }
}

async function markExerciseComplete(exerciseId) {
    try {
        await apiRequest(`/exercises/${exerciseId}/complete`, {
            method: 'PATCH'
        });
        return true;
    } catch (error) {
        console.error('Error marking exercise complete:', error);
        return false;
    }
}

async function markExerciseIncomplete(exerciseId) {
    try {
        await apiRequest(`/exercises/${exerciseId}/incomplete`, {
            method: 'PATCH'
        });
        return true;
    } catch (error) {
        console.error('Error marking exercise incomplete:', error);
        return false;
    }
}

async function getWeeklyProgress() {
    try {
        const data = await apiRequest('/workouts/progress/weekly');
        return data.progress;
    } catch (error) {
        console.error('Error loading weekly progress:', error);
        return { total: 0, completed: 0, percentage: 0 };
    }
}

// Calendar Functions
async function loadCalendarData(year, month) {
    try {
        const data = await apiRequest(`/progress/calendar/${year}/${month}`);
        return data.calendar;
    } catch (error) {
        console.error('Error loading calendar data:', error);
        return [];
    }
}

async function loadStreakData() {
    try {
        const data = await apiRequest('/progress/streak');
        return data;
    } catch (error) {
        console.error('Error loading streak data:', error);
        return { currentStreak: 0, longestStreak: 0 };
    }
}

async function loadMonthlyStats() {
    try {
        const data = await apiRequest('/progress/stats');
        return data.last30Days;
    } catch (error) {
        console.error('Error loading monthly stats:', error);
        return { totalWorkouts: 0, averageCompletionRate: 0 };
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
        return;
    }

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
                        <div class="task-item">
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
        <div class="bg-white p-6 sm:p-8 rounded-2xl shadow-lg">
            <h2 class="text-3xl font-bold mb-2">${workout.title}</h2>
            <p class="text-md text-slate-500 mb-6">${workout.focus}</p>
            
            <div class="mb-6">
                <div class="flex justify-between items-center mb-1 text-sm">
                    <span>Progress</span>
                    <span>${completedExercises} / ${totalExercises}</span>
                </div>
                <div class="w-full bg-slate-200 rounded-full h-2.5">
                    <div class="bg-cyan-600 h-2.5 rounded-full transition-all duration-300" style="width: ${progressPercentage}%"></div>
                </div>
            </div>

            ${createExerciseHtml(warmupExercises, 'Warm-Up')}
            ${createExerciseHtml(workoutExercises, 'Workout')}
            ${createExerciseHtml(cooldownExercises, 'Cool-Down')}
        </div>
    `;

    // Add event listeners to checkboxes
    document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', async (e) => {
            const exerciseId = e.target.id.replace('exercise-', '');
            const isCompleted = e.target.checked;
            
            try {
                if (isCompleted) {
                    await markExerciseComplete(exerciseId);
                } else {
                    await markExerciseIncomplete(exerciseId);
                }
                
                // Update progress
                updateWeeklyProgress();
            } catch (error) {
                console.error('Error updating exercise:', error);
                // Revert checkbox state
                e.target.checked = !isCompleted;
            }
        });
    });
}

function renderCalendar(calendarData) {
    const calendarGrid = document.getElementById('calendar-grid');
    const currentMonthElement = document.getElementById('current-month');
    
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
        dayElement.className = `calendar-day p-2 text-center border border-slate-200 min-h-[60px] flex flex-col justify-center items-center cursor-pointer`;
        
        if (!day.isCurrentMonth) {
            dayElement.classList.add('text-slate-400');
        }
        
        if (day.isToday) {
            dayElement.classList.add('ring-2', 'ring-cyan-500');
        }
        
        if (day.progress.total > 0) {
            dayElement.classList.add('has-workout');
            if (day.progress.completed === day.progress.total) {
                dayElement.classList.add('completed');
            }
        }

        dayElement.innerHTML = `
            <div class="text-sm font-medium">${new Date(day.date).getDate()}</div>
            ${day.progress.total > 0 ? `
                <div class="text-xs mt-1">
                    ${day.progress.completed}/${day.progress.total}
                </div>
            ` : ''}
        `;

        dayElement.addEventListener('click', () => {
            if (day.isCurrentMonth) {
                // Navigate to workout for this day
                const dayOfWeek = new Date(day.date).getDay();
                const dayKey = `day${dayOfWeek === 0 ? 7 : dayOfWeek}`;
                loadWorkoutByDay(dayKey).then(renderWorkout);
                
                // Switch to workouts tab
                switchTab('workouts');
            }
        });

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
            <div class="text-3xl font-bold text-cyan-600">${monthlyStats.totalWorkouts}</div>
            <div class="text-sm text-slate-500">Workouts This Month</div>
        </div>
        <div class="text-center">
            <div class="text-3xl font-bold text-green-600">${Math.round(monthlyStats.averageCompletionRate)}%</div>
            <div class="text-sm text-slate-500">Completion Rate</div>
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
    renderWorkoutNavigation(workouts);
    updateWeeklyProgress();
}

async function loadCalendarData() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    const calendarData = await loadCalendarData(year, month);
    renderCalendar(calendarData);
}

async function loadProgressData() {
    const [streakData, monthlyStats] = await Promise.all([
        loadStreakData(),
        loadMonthlyStats()
    ]);
    renderProgress(streakData, monthlyStats);
}

function renderWorkoutNavigation(workouts) {
    const dayNavigation = document.getElementById('day-navigation');
    dayNavigation.innerHTML = '';

    const days = ['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'];
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    days.forEach((day, index) => {
        const workout = workouts.find(w => w.day === day);
        const navButton = document.createElement('button');
        navButton.className = 'nav-item w-full text-left p-4 rounded-lg hover:bg-cyan-600 hover:text-white transition-colors duration-200';
        navButton.dataset.day = day;
        
        if (workout) {
            navButton.innerHTML = `
                <p class="font-semibold">${dayNames[index]}: ${workout.title}</p>
                <p class="text-sm opacity-80">${workout.focus}</p>
                ${workout.completed ? '<span class="text-green-500 text-sm">✓ Completed</span>' : ''}
            `;
        } else {
            navButton.innerHTML = `
                <p class="font-semibold">${dayNames[index]}</p>
                <p class="text-sm opacity-80">No workout scheduled</p>
            `;
        }

        navButton.addEventListener('click', async () => {
            document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
            navButton.classList.add('active');

            const workoutData = await loadWorkoutByDay(day);
            renderWorkout(workoutData);
        });

        dayNavigation.appendChild(navButton);
    });
}

async function updateWeeklyProgress() {
    const progress = await getWeeklyProgress();
    const progressElement = document.getElementById('weekly-progress');
    progressElement.innerHTML = `
        <div class="text-2xl font-bold text-cyan-600">${progress.percentage}%</div>
        <div class="text-sm text-slate-500">${progress.completed} of ${progress.total} workouts completed</div>
    `;
}

// Initialize the application
async function initializeApp() {
    try {
        // Load initial data
        await loadWorkoutData();
        
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
    } catch (error) {
        console.error('Error initializing app:', error);
    }
}

function initializeChart() {
    const ctx = document.getElementById('weeklySplitChart').getContext('2d');
    new Chart(ctx, {
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
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication on load
    checkAuth();

    // Tab switching
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            switchTab(tabName);
        });
    });

    // Calendar navigation
    document.getElementById('prev-month').addEventListener('click', () => {
        currentMonth.setMonth(currentMonth.getMonth() - 1);
        loadCalendarData();
    });

    document.getElementById('next-month').addEventListener('click', () => {
        currentMonth.setMonth(currentMonth.getMonth() + 1);
        loadCalendarData();
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