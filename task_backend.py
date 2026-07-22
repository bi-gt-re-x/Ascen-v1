"""
Task Backend Utilities
===================

This file contains utilities for testing and verifying the task database system.
Includes functions for:
- Database schema verification
- Test task creation
- Database state checking
- XP tracking and reporting
- API testing
- Dashboard debugging
- Calendar progress tracking and completion logic
"""

import sqlite3
import requests
import json
import os
from datetime import datetime, date, timedelta

# JSON file paths
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
CALENDAR_JSON = os.path.join(DATA_DIR, 'calendar.json')
TASKS_JSON = os.path.join(DATA_DIR, 'tasks.json')
USERS_JSON = os.path.join(DATA_DIR, 'users.json')

def read_json_file(filepath):
    """Read data from a JSON file"""
    try:
        if os.path.exists(filepath):
            with open(filepath, 'r') as f:
                return json.load(f)
        return []
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return []

def write_json_file(filepath, data):
    """Write data to a JSON file"""
    try:
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
        return True
    except Exception as e:
        print(f"Error writing {filepath}: {e}")
        return False

def mark_task_completed_in_calendar(task_id, username):
    """
    Mark a task as completed in the calendar system.
    This function handles the calendar progress tracking logic.
    """
    print(f"=== MARK TASK COMPLETED IN CALENDAR ===")
    print(f"Task ID: {task_id}")
    print(f"Username: {username}")
    
    # Read calendar entries from JSON file
    calendar_entries = read_json_file(CALENDAR_JSON)
    
    # Read tasks from JSON file
    tasks = read_json_file(TASKS_JSON)
    
    # Find the task
    task = None
    for t in tasks:
        if t.get('id') == task_id and t.get('user_id') == username:
            task = t
            break
    
    if not task:
        print(f"ERROR: Task not found: {task_id}")
        return {"success": False, "message": "Task not found"}
    
    print(f"Task found: {task.get('title', 'No title')}")
    
    # Mark the task as completed in the task JSON file
    task['status'] = 'done'
    write_json_file(TASKS_JSON, tasks)
    
    # Update calendar entries associated with this task
    updated_count = 0
    for entry in calendar_entries:
        if entry.get('task_id') == task_id and entry.get('user_id') == username:
            # Mark the calendar entry as completed
            entry['completed'] = True
            entry['completed_at'] = datetime.now().isoformat()
            updated_count += 1
            print(f"Marked calendar entry as completed: {entry.get('date', 'No date')}")
    
    # Write updated calendar entries
    write_json_file(CALENDAR_JSON, calendar_entries)
    
    print(f"Total calendar entries updated: {updated_count}")
    print(f"=== CALENDAR UPDATE COMPLETE ===")
    
    return {
        "success": True,
        "message": f"Task marked as completed in calendar. {updated_count} calendar entries updated."
    }

def get_calendar_progress(username):
    """
    Get calendar progress data for a user.
    Returns calendar entries and completion statistics.
    """
    # Read calendar entries from JSON file
    calendar_entries = read_json_file(CALENDAR_JSON)
    
    # Filter entries by username
    user_entries = [entry for entry in calendar_entries if entry.get('user_id') == username]
    
    # Calculate statistics
    total_entries = len(user_entries)
    completed_entries = len([entry for entry in user_entries if entry.get('completed', False)])
    completion_rate = (completed_entries / total_entries * 100) if total_entries > 0 else 0
    
    # Group by date
    entries_by_date = {}
    for entry in user_entries:
        date_str = entry.get('date', 'Unknown')
        if date_str not in entries_by_date:
            entries_by_date[date_str] = []
        entries_by_date[date_str].append(entry)
    
    return {
        "success": True,
        "total_entries": total_entries,
        "completed_entries": completed_entries,
        "completion_rate": completion_rate,
        "entries_by_date": entries_by_date,
        "entries": user_entries
    }

def sync_task_to_calendar(task_id, username, date, time_block=None, recurrence_month=None, recurrence_week=None, end_date=None, name=None):
    """
    Sync a task to the calendar system.
    Creates a calendar entry for the task with support for recurrence-month, recurrence-week, end_date, names, etc.
    """
    # Read calendar entries from JSON file
    calendar_entries = read_json_file(CALENDAR_JSON)
    
    # Read tasks from JSON file
    tasks = read_json_file(TASKS_JSON)
    
    # Find the task
    task = None
    for t in tasks:
        if t.get('id') == task_id and t.get('user_id') == username:
            task = t
            break
    
    # Create calendar entry with comprehensive fields
    new_entry = {
        "id": str(int(datetime.now().timestamp() * 1000)),
        "name": name or (task.get('title', 'Untitled') if task else 'Untitled'),
        "recurrence-month": recurrence_month or None,
        "recurrence-week": recurrence_week or None,
        "end_date": end_date or None,
        "date": date,
        "time_block": time_block,
        "description": '',
        "completed": False,
        "created_at": datetime.now().isoformat()
    }
    
    calendar_entries.append(new_entry)
    write_json_file(CALENDAR_JSON, calendar_entries)
    
    return {"success": True, "entry_id": new_entry["id"], "message": "Task synced to calendar"}

def create_calendar_event(name, date, time_block, recurrence_month=None, recurrence_week=None, end_date=None, description=''):
    """
    Create a new calendar event.
    """
    calendar_entries = read_json_file(CALENDAR_JSON)
    
    new_entry = {
        "id": str(int(datetime.now().timestamp() * 1000)),
        "name": name,
        "recurrence-month": recurrence_month or None,
        "recurrence-week": recurrence_week or None,
        "end_date": end_date or None,
        "date": date,
        "time_block": time_block,
        "description": '',
        "completed": False,
        "created_at": datetime.now().isoformat(),
        "is_default": False
    }
    
    calendar_entries.append(new_entry)
    write_json_file(CALENDAR_JSON, calendar_entries)
    
    return {"success": True, "entry_id": new_entry["id"], "message": "Calendar event created"}

def delete_calendar_event(event_id):
    """
    Delete a calendar event (only non-default events).
    """
    calendar_entries = read_json_file(CALENDAR_JSON)
    
    # Find the event
    event_to_delete = None
    for event in calendar_entries:
        if event.get('id') == event_id:
            event_to_delete = event
            break
    
    if not event_to_delete:
        return {"success": False, "message": "Event not found"}
    
    # Prevent deletion of default events
    if event_to_delete.get('is_default', False):
        return {"success": False, "message": "Cannot delete default events"}
    
    # Remove the event
    calendar_entries = [event for event in calendar_entries if event.get('id') != event_id]
    write_json_file(CALENDAR_JSON, calendar_entries)
    
    return {"success": True, "message": "Calendar event deleted"}

def get_default_events():
    """
    Get all default calendar events.
    """
    calendar_entries = read_json_file(CALENDAR_JSON)
    default_events = [event for event in calendar_entries if event.get('is_default', False)]
    return default_events

def get_custom_events():
    """
    Get all custom (non-default) calendar events.
    """
    calendar_entries = read_json_file(CALENDAR_JSON)
    custom_events = [event for event in calendar_entries if not event.get('is_default', False)]
    return custom_events

def check_database_schema():
    """Check all database tables and their structure"""
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    print("=== DATABASE VERIFICATION ===")
    
    # Check users table
    print("\n1. USERS TABLE:")
    cursor.execute("SELECT username, created_at FROM users")
    users = cursor.fetchall()
    for user in users:
        print(f"  - {user[0]} (created: {user[1]})")
    
    # Check user_stats table
    print("\n2. USER_STATS TABLE:")
    cursor.execute("SELECT username, level, xp, tasks_completed FROM user_stats")
    stats = cursor.fetchall()
    for stat in stats:
        print(f"  - {stat[0]}: Level {stat[1]}, XP {stat[2]}, Tasks {stat[3]}")
    
    # Check tasks table
    print("\n3. TASKS TABLE:")
    cursor.execute("SELECT username, name, xp_reward, priority FROM tasks")
    tasks = cursor.fetchall()
    if tasks:
        print(f"  Found {len(tasks)} tasks:")
        for task in tasks[:5]:  # Show first 5 tasks
            print(f"    - {task[1]} ({task[0]}) - {task[2]} XP - {task[3]} priority")
        if len(tasks) > 5:
            print(f"    ... and {len(tasks) - 5} more tasks")
    else:
        print("  No tasks found")
    
    # Check daily_xp table
    print("\n4. DAILY_XP TABLE:")
    cursor.execute("SELECT username, date, xp_earned, tasks_completed FROM daily_xp ORDER BY date DESC")
    daily_xp = cursor.fetchall()
    if daily_xp:
        print(f"  Found {len(daily_xp)} daily XP records:")
        for record in daily_xp[:7]:  # Show last 7 records
            print(f"    - {record[0]} on {record[1]}: {record[2]} XP, {record[3]} tasks")
        if len(daily_xp) > 7:
            print(f"    ... and {len(daily_xp) - 7} more records")
    else:
        print("  No daily XP records found")
    
    conn.close()
    print("\n=== VERIFICATION COMPLETE ===")


def create_test_task():
    """Create a test task to verify database functionality"""
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    # Create a test task for SMYULES
    test_task = {
        'id': 'test_task_001',
        'username': 'SMYULES',
        'name': 'Test Task for Verification',
        'description': '',
        'priority': 'medium',
        'xp_reward': 25,
        'timer_duration': 300  # 5 minutes
    }
    
    try:
        cursor.execute('''
            INSERT INTO tasks (id, username, name, description, priority, xp_reward, timer_duration)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            test_task['id'],
            test_task['username'],
            test_task['name'],
            test_task['description'],
            test_task['priority'],
            test_task['xp_reward'],
            test_task['timer_duration']
        ))
        
        conn.commit()
        print(f"Successfully created test task: {test_task['name']}")
        print(f"   Task ID: {test_task['id']}")
        print(f"   XP Reward: {test_task['xp_reward']}")
        print(f"   Priority: {test_task['priority']}")
        
    except Exception as e:
        print(f"Error creating test task: {e}")
    
    conn.close()


def create_tracking_tables():
    """Create the daily_xp table and add created_at column to users table"""
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    try:
        # Create daily_xp table to track XP earned per day
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS daily_xp (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                date DATE NOT NULL,
                xp_earned INTEGER NOT NULL DEFAULT 0,
                tasks_completed INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(username, date),
                FOREIGN KEY(username) REFERENCES users(username)
            )
        ''')
        print("✅ Created daily_xp table")
        
        # Add created_at column to users table
        try:
            cursor.execute('ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT NULL')
            print("✅ Added created_at column to users table")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print("✅ created_at column already exists in users table")
            else:
                print(f"❌ Error adding created_at column: {e}")
        
        # Update existing users without created_at date
        try:
            cursor.execute('''
                UPDATE users 
                SET created_at = CURRENT_TIMESTAMP 
                WHERE created_at IS NULL
            ''')
            print("✅ Updated existing users with creation date")
        except Exception as e:
            print(f"❌ Error updating users: {e}")
        
        conn.commit()
        print("✅ Database tracking setup complete!")
        
    except Exception as e:
        print(f"❌ Error creating tracking tables: {e}")
    
    conn.close()


def generate_xp_report():
    """Generate comprehensive XP tracking report"""
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    print("COMPREHENSIVE XP TRACKING REPORT")
    print("=" * 60)
    
    # Get user info
    cursor.execute("SELECT username, created_at FROM users WHERE username=?", ('SMYULES',))
    user = cursor.fetchone()
    if not user:
        print("User SMYULES not found")
        return
    
    created_date = user[1] if user[1] else date.today()
    if isinstance(created_date, str):
        created_date = datetime.strptime(created_date, '%Y-%m-%d %H:%M:%S').date()
    print(f"\nUser: {user[0]}")
    print(f"   Account Created: {created_date}")
    print(f"   Days Active: {(date.today() - created_date).days}")
    
    # Get current user stats
    cursor.execute("SELECT level, xp, tasks_completed FROM user_stats WHERE username=?", ('SMYULES',))
    stats = cursor.fetchone()
    if not stats:
        print("User stats not found")
        return
    
    print(f"\nCurrent Stats:")
    print(f"   Level: {stats[0]}")
    print(f"   Total XP: {stats[1]}")
    print(f"   Tasks Completed: {stats[2]}")
    
    # Get daily XP records
    cursor.execute('''
        SELECT date, xp_earned, tasks_completed 
        FROM daily_xp 
        WHERE username = ? 
        ORDER BY date DESC 
        LIMIT 30
    ''', ('SMYULES',))
    
    daily_records = cursor.fetchall()
    print(f"\nDaily XP Records (Last {len(daily_records)} days):")
    
    # Calculate cumulative XP and level progression
    total_xp = 0
    cumulative_xp = 0
    level_progression = []
    
    for i, record in enumerate(daily_records):
        record_date = datetime.strptime(record[0], '%Y-%m-%d').date()
        days_since_creation = (record_date - created_date).days + 1
        xp_earned = record[1]
        tasks_completed = record[2]
        
        total_xp += xp_earned
        cumulative_xp += xp_earned
        
        # Calculate what level should be at this point
        current_level = 1
        xp_needed_for_level = 100
        while cumulative_xp >= xp_needed_for_level:
            cumulative_xp -= xp_needed_for_level
            current_level += 1
            xp_needed_for_level = current_level * 100
        
        level_progression.append({
            'day': days_since_creation,
            'date': record[0],
            'xp_earned': xp_earned,
            'tasks_completed': tasks_completed,
            'cumulative_xp': cumulative_xp,
            'current_level': current_level,
            'level_up': current_level > (level_progression[i-1]['current_level'] if i > 0 else 1)
        })
        
        print(f"   Day {days_since_creation}: {record[0]} - +{xp_earned} XP, {tasks_completed} tasks (Level {current_level})")
    
    print(f"\nLevel Progression Analysis:")
    print(f"   Starting Level: 1")
    print(f"   Current Level: {level_progression[-1]['current_level'] if level_progression else 1}")
    print(f"   Total Level Ups: {sum(1 for lp in level_progression if lp['level_up'])}")
    
    # Find days with highest XP
    if daily_records:
        max_xp_day = max(daily_records, key=lambda x: x[1])
        print(f"\nMost Productive Day: {max_xp_day[0]} (+{max_xp_day[1]} XP)")
    
    # Calculate XP averages
    if daily_records:
        avg_xp_per_day = sum(record[1] for record in daily_records) / len(daily_records)
        avg_tasks_per_day = sum(record[2] for record in daily_records) / len(daily_records)
        print(f"\nAverages:")
        print(f"   Average XP/Day: {avg_xp_per_day:.1f}")
        print(f"   Average Tasks/Day: {avg_tasks_per_day:.1f}")
    
    # Check if level 5+ is achievable
    if level_progression and level_progression[-1]['current_level'] >= 5:
        print(f"\nCONGRATULATIONS! You've reached Level {level_progression[-1]['current_level']}+!")
        print("   Achievement Unlocked: Advanced Features Available")
    else:
        current_level = level_progression[-1]['current_level'] if level_progression else 1
        xp_to_next_level = (current_level * 100) - (stats[1] if stats else 0)
        print(f"\nProgress to Next Level:")
        print(f"   Current Level: {current_level}")
        print(f"   XP to Level {current_level + 1}: {xp_to_next_level}")
        print(f"   Progress: {((stats[1] if stats else 0) / (current_level * 100)) * 100:.1f}%")
    
    conn.close()
    print("\n" + "=" * 60)
    print("System is working correctly - tasks are being tracked and levels are progressing!")


def test_get_user_data():
    """Test the get_user_data API endpoint"""
    try:
        # Test the API endpoint directly
        response = requests.get('http://localhost:5000/api/get_user_data?username=SMYULES')
        
        if response.status_code == 200:
            data = response.json()
            print("=== API RESPONSE ===")
            print(json.dumps(data, indent=2))
            
            if data.get('success'):
                print(f"\n✅ API Success")
                print(f"✅ User Stats: {data.get('stats', {})}")
                print(f"✅ Tasks Found: {len(data.get('tasks', []))}")
                
                if data.get('tasks'):
                    print("\n📋 Tasks Details:")
                    for i, task in enumerate(data['tasks'][:5], 1):
                        print(f"  {i}. {task.get('name', 'No name')} - {task.get('xp_reward', 0)} XP")
                else:
                    print("❌ No tasks in response")
            else:
                print(f"❌ API Failed: {data.get('message', 'Unknown error')}")
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection Error: Could not connect to the API")
        print("Make sure the Flask app is running on localhost:5000")
    except Exception as e:
        print(f"❌ Error: {e}")


def test_dashboard_loading():
    """Test dashboard task loading specifically"""
    print("DASHBOARD DEBUG TEST")
    
    try:
        # Test the API endpoint that dashboard uses
        response = requests.get('http://localhost:5000/api/get_user_data?username=SMYULES', timeout=10)
        
        print(f"HTTP Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            print(f"API Success: {data.get('success', False)}")
            print(f"Message: {data.get('message', 'No message')}")
            
            # Check if tasks are in the response
            tasks = data.get('tasks', [])
            print(f"Tasks in response: {len(tasks)}")
            
            if tasks:
                print("\nTask Details:")
                for i, task in enumerate(tasks[:3]):  # Show first 3 tasks
                    print(f"  Task {i+1}:")
                    print(f"    ID: {task.get('id', 'No ID')}")
                    print(f"    Name: {task.get('name', 'No Name')}")
                    print(f"    XP: {task.get('xp_reward', 0)}")
                    print(f"    Description: ''")
                    
            # Check if createTaskElement function exists in global scope
            print("\nFunction Check:")
            print("  Checking if dashboard.html has createTaskElement function...")
            
            # Test if we can access the dashboard page itself
            dashboard_response = requests.get('http://localhost:5000/dashboard', timeout=5)
            print(f"Dashboard Page Status: {dashboard_response.status_code}")
            
            if dashboard_response.status_code == 200:
                print("Dashboard page loads successfully")
                # Check if the page contains the task creation function
                if 'createTaskElement' in dashboard_response.text:
                    print("createTaskElement function found in dashboard.html")
                else:
                    print("createTaskElement function NOT found in dashboard.html")
                    
        else:
            print("API call failed")
            
    except requests.exceptions.ConnectionError:
        print("Cannot connect to Flask app")
        print("Make sure the app is running on localhost:5000")
    except Exception as e:
        print(f"Error: {e}")


def ensure_daily_tracking(username='SMYULES'):
    """Ensure every day has a daily_xp record, even if no XP was gained"""
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    try:
        # Get user creation date
        cursor.execute("SELECT username, created_at FROM users WHERE username=?", (username,))
        user = cursor.fetchone()
        if not user:
            print(f"User {username} not found")
            return
        
        created_date = user[1] if user[1] else date.today()
        if isinstance(created_date, str):
            created_date = datetime.strptime(created_date, '%Y-%m-%d %H:%M:%S').date()
        
        # Get all existing daily records
        cursor.execute("SELECT date FROM daily_xp WHERE username=?", (username,))
        existing_dates = {row[0] for row in cursor.fetchall()}
        
        # Generate all dates from creation to today
        current_date = date.today()
        dates_to_add = []
        
        while created_date <= current_date:
            date_str = created_date.isoformat()
            if date_str not in existing_dates:
                dates_to_add.append(date_str)
            created_date += timedelta(days=1)
        
        # Add missing daily records with 0 XP
        if dates_to_add:
            print(f"Adding {len(dates_to_add)} missing daily records for {username}...")
            for date_str in dates_to_add:
                cursor.execute('''
                    INSERT INTO daily_xp (username, date, xp_earned, tasks_completed, avg_task_xp)
                    VALUES (?, ?, 0, 0, 0)
                ''', (username, date_str))
            
            conn.commit()
            print(f"[OK] Added daily records for: {', '.join(dates_to_add[:5])}{'...' if len(dates_to_add) > 5 else ''}")
        else:
            print(f"[OK] All daily records are up to date for {username}")
        
        # Show summary
        cursor.execute("SELECT COUNT(*) FROM daily_xp WHERE username=?", (username,))
        total_days = cursor.fetchone()[0]
        cursor.execute("SELECT SUM(xp_earned) FROM daily_xp WHERE username=?", (username,))
        total_xp = cursor.fetchone()[0] or 0
        
        print(f"Daily Tracking Summary:")
        print(f"  Total days tracked: {total_days}")
        print(f"  Total XP earned: {total_xp}")
        print(f"  Average XP/day: {total_xp/total_days:.1f}" if total_days > 0 else "  Average XP/day: 0")
        
    except Exception as e:
        print(f"[ERROR] Error ensuring daily tracking: {e}")
        conn.rollback()
    finally:
        conn.close()


def get_xp_data_for_js(username):
    """Get XP data from database in JSON format for JavaScript consumption"""
    # Ensure all days have records before fetching data
    ensure_daily_tracking(username)
    
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    try:
        # Get user info
        cursor.execute("SELECT username, created_at FROM users WHERE username=?", (username,))
        user = cursor.fetchone()
        if not user:
            return {"success": False, "message": "User not found"}
        
        created_date = user[1] if user[1] else date.today()
        if isinstance(created_date, str):
            created_date = datetime.strptime(created_date, '%Y-%m-%d %H:%M:%S').date()
        
        # Get daily XP records
        cursor.execute('''
            SELECT date, xp_earned, tasks_completed, avg_task_xp 
            FROM daily_xp 
            WHERE username = ? 
            ORDER BY date ASC
        ''', (username,))
        
        daily_records = cursor.fetchall()
        
        # Process data for JavaScript
        growth_data = []
        cumulative_xp = 0
        
        # Generate data for each day from creation to today
        current_date = created_date
        end_date = date.today()
        day_number = 1
        
        while current_date <= end_date:
            date_str = current_date.isoformat()
            
            # Find matching daily record
            day_record = next((record for record in daily_records if record[0] == date_str), None)
            
            if day_record:
                xp_earned = day_record[1]
                tasks_completed = day_record[2]
                avg_task_xp = day_record[3] if len(day_record) > 3 else (xp_earned / tasks_completed if tasks_completed > 0 else 0)
            else:
                xp_earned = 0
                tasks_completed = 0
                avg_task_xp = 0
            
            cumulative_xp += xp_earned
            
            growth_data.append({
                'date': date_str,
                'day_number': day_number,
                'xp_earned': xp_earned,
                'tasks_completed': tasks_completed,
                'cumulative_xp': cumulative_xp,
                'avg_task_xp': avg_task_xp
            })
            
            current_date += timedelta(days=1)
            day_number += 1
        
        # Get current user stats
        cursor.execute("SELECT level, xp, tasks_completed FROM user_stats WHERE username=?", (username,))
        stats = cursor.fetchone()
        
        # Calculate correct level based on total XP (infinite progression)
        total_xp = stats[1] if stats else 0
        calculated_level = 1
        xp_needed_for_level = 100
        temp_xp = total_xp
        
        while temp_xp >= xp_needed_for_level:
            temp_xp -= xp_needed_for_level
            calculated_level += 1
            xp_needed_for_level = calculated_level * 100
        
        current_xp_in_level = temp_xp
        
        return {
            "success": True,
            "user": {
                "username": user[0],
                "created_date": created_date.isoformat(),
                "days_active": (date.today() - created_date).days + 1
            },
            "stats": {
                "level": calculated_level,
                "current_xp": current_xp_in_level,
                "total_xp": total_xp,
                "xp_required": xp_needed_for_level,
                "tasks_completed": stats[2] if stats else 0
            },
            "growth_data": growth_data,
            "summary": {
                "total_days": len(growth_data),
                "total_xp": cumulative_xp,
                "average_xp_per_day": cumulative_xp / len(growth_data) if growth_data else 0,
                "most_productive_day": max(growth_data, key=lambda x: x['xp_earned']) if growth_data else None
            }
        }
        
    except Exception as e:
        return {"success": False, "message": f"Error: {e}"}
    finally:
        conn.close()


def fix_levels_in_database():
    """Recalculate and fix levels for all users based on their total XP"""
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    try:
        # Get all users
        cursor.execute("SELECT username, xp FROM user_stats")
        users = cursor.fetchall()
        
        print("FIXING LEVELS IN DATABASE:")
        print("=" * 40)
        
        for username, total_xp in users:
            # Calculate correct level
            calculated_level = 1
            xp_needed_for_level = 100
            temp_xp = total_xp
            
            while temp_xp >= xp_needed_for_level:
                temp_xp -= xp_needed_for_level
                calculated_level += 1
                xp_needed_for_level = calculated_level * 100
            
            # Get current level from database
            cursor.execute("SELECT level FROM user_stats WHERE username=?", (username,))
            current_level = cursor.fetchone()[0]
            
            # Update if incorrect
            if calculated_level != current_level:
                cursor.execute('''
                    UPDATE user_stats 
                    SET level = ?
                    WHERE username = ?
                ''', (calculated_level, username))
                
                print(f"Updated {username}: Level {current_level} -> Level {calculated_level}")
                print(f"  Total XP: {total_xp}, Current XP in level: {temp_xp}, Next level requires: {xp_needed_for_level}")
            else:
                print(f"{username}: Level {calculated_level} (correct)")
        
        conn.commit()
        print("\n[OK] Level fixes completed!")
        
    except Exception as e:
        print(f"[ERROR] Error fixing levels: {e}")
        conn.rollback()
    finally:
        conn.close()


def create_comprehensive_growth_tables():
    """Create all necessary tables for growth analytics"""
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    try:
        # Enable foreign keys
        cursor.execute("PRAGMA foreign_keys = ON")
        
        # Create cumulative_xp table for storing cumulative XP data
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS cumulative_xp (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                date DATE NOT NULL,
                cumulative_xp INTEGER NOT NULL DEFAULT 0,
                level INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(username, date),
                FOREIGN KEY(username) REFERENCES users(username)
            )
        ''')
        print("cumulative_xp table created")
        
        # Add avg_task_xp column to daily_xp if it doesn't exist
        try:
            cursor.execute("ALTER TABLE daily_xp ADD COLUMN avg_task_xp REAL DEFAULT 0")
            print("Added avg_task_xp column to daily_xp table")
        except sqlite3.OperationalError:
            print("avg_task_xp column already exists in daily_xp table")
        
        conn.commit()
        print("Comprehensive growth tables created successfully!")
        
    except Exception as e:
        print(f"Error creating comprehensive growth tables: {e}")
        conn.rollback()
    finally:
        conn.close()


def create_sample_growth_data():
    """Create sample data for testing growth charts"""
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    try:
        import random
        
        # Get all users
        cursor.execute("SELECT username FROM users")
        users = cursor.fetchall()
        
        if not users:
            print("No users found. Creating a test user first...")
            cursor.execute("INSERT INTO users (username, password) VALUES (?, ?)", ('testuser', 'password'))
            cursor.execute("INSERT INTO user_stats (username, level, xp, tasks_completed) VALUES (?, 1, 0, 0)", ('testuser',))
            users = [('testuser',)]
        
        for (username,) in users:
            print(f"Creating sample data for user: {username}")
            
            # Check if data already exists
            cursor.execute("SELECT COUNT(*) FROM daily_xp WHERE username = ?", (username,))
            existing_data = cursor.fetchone()[0]
            
            if existing_data > 0:
                print(f"User {username} already has {existing_data} daily records. Skipping sample data creation.")
                continue
            
            # Create sample data for the last 30 days
            start_date = date.today() - timedelta(days=29)
            cumulative_xp = 0
            level = 1
            
            for day_offset in range(30):
                current_date = start_date + timedelta(days=day_offset)
                
                # Generate realistic sample data
                daily_xp = random.randint(10, 150)  # Random XP between 10-150
                tasks_completed = random.randint(1, 8)  # Random tasks between 1-8
                avg_task_xp = daily_xp / tasks_completed if tasks_completed > 0 else 0
                
                cumulative_xp += daily_xp
                
                # Calculate level based on cumulative XP
                temp_xp = cumulative_xp
                xp_needed_for_level = 100
                while temp_xp >= xp_needed_for_level:
                    temp_xp -= xp_needed_for_level
                    level += 1
                    xp_needed_for_level = level * 100
                
                # Insert daily XP data
                cursor.execute('''
                    INSERT OR IGNORE INTO daily_xp 
                    (username, date, xp_earned, tasks_completed, avg_task_xp)
                    VALUES (?, ?, ?, ?, ?)
                ''', (username, current_date.isoformat(), daily_xp, tasks_completed, avg_task_xp))
                
                # Insert cumulative XP data
                cursor.execute('''
                    INSERT OR IGNORE INTO cumulative_xp 
                    (username, date, cumulative_xp, level)
                    VALUES (?, ?, ?, ?)
                ''', (username, current_date.isoformat(), cumulative_xp, level))
            
            print(f"Created 30 days of sample data for {username}")
        
        conn.commit()
        print("Sample data created successfully!")
        
    except Exception as e:
        print(f"Error creating sample data: {e}")
        conn.rollback()
    finally:
        conn.close()


def test_database():
    """Run all database tests"""
    print("Running complete database verification...")
    check_database_schema()
    print("\n" + "="*50)
    print("Ensuring daily tracking...")
    ensure_daily_tracking()
    print("\n" + "="*50)
    print("Creating comprehensive growth tables...")
    create_comprehensive_growth_tables()
    print("\n" + "="*50)
    print("Creating sample growth data...")
    create_sample_growth_data()
    print("\n" + "="*50)
    print("Creating test task...")
    create_test_task()
    print("\n" + "="*50)
    print("Database testing complete!")


if __name__ == "__main__":
    # You can run specific tests or all tests
    import sys
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        if command == "schema":
            check_database_schema()
        elif command == "test":
            create_test_task()
        elif command == "tables":
            create_tracking_tables()
        elif command == "daily":
            ensure_daily_tracking()
        elif command == "xp_data":
            data = get_xp_data_for_js()
            print("XP DATA FOR JAVASCRIPT:")
            print(json.dumps(data, indent=2))
        elif command == "fix_levels":
            fix_levels_in_database()
        elif command == "xp":
            generate_xp_report()
        elif command == "api":
            test_get_user_data()
        elif command == "dashboard":
            test_dashboard_loading()
        elif command == "set_streak":
            # Set SMYULES streak to 2
            conn = sqlite3.connect('database.db')
            cursor = conn.cursor()
            cursor.execute('UPDATE user_stats SET current_streak = 2, best_streak = 2 WHERE username = ?', ('SMYULES',))
            conn.commit()
            print("Updated SMYULES streak to 2")
            conn.close()
        elif command == "all":
            test_database()
        else:
            print(f"Unknown command: {command}")
            print("Available commands: schema, test, tables, daily, xp_data, fix_levels, xp, api, dashboard, set_streak, all")
    else:
        test_database()
