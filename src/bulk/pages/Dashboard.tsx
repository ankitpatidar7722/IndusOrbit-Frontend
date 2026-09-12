import React from 'react';
import { TrendingUp, Users, Database, Activity } from 'lucide-react';

const Dashboard: React.FC = () => {
    const stats = [
        { name: 'Total Imports', value: '1,234', icon: Database, color: 'bg-blue-500' },
        { name: 'Success Rate', value: '98.5%', icon: TrendingUp, color: 'bg-green-500' },
        { name: 'Active Modules', value: '12', icon: Activity, color: 'bg-purple-500' },
        { name: 'Total Users', value: '45', icon: Users, color: 'bg-orange-500' },
    ];

    return (
        <div className="p-6 space-y-6 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Welcome to Bulk Import System</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <div key={stat.name} className="card hover:shadow-xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.name}</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{stat.value}</p>
                                </div>
                                <div className={`${stat.color} p-3 rounded-lg`}>
                                    <Icon className="w-6 h-6 text-white" />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card">
                    <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Recent Activity</h2>
                    <div className="space-y-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Import completed - Module {i}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{i} hours ago</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card">
                    <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Quick Actions</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <button className="btn btn-primary p-6 flex flex-col items-center gap-2">
                            <Database className="w-8 h-8" />
                            <span>New Import</span>
                        </button>
                        <button className="btn bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 p-6 flex flex-col items-center gap-2">
                            <Users className="w-8 h-8" />
                            <span>View Reports</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
