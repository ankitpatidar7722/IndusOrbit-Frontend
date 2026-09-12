import React, { useState, useEffect } from 'react';
import {
  Clock,
  User,
  Activity,
  AlertCircle,
  CheckCircle,
  Filter,
  Download,
  RefreshCw,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { getActivityLogs, getActivitySummary, getActivityLogUsernames, ActivityLogDto, ActivityLogFilterRequest, ActivityLogSummary } from '../services/api';
import { format } from 'date-fns';

interface ActivityLogViewerProps {
  entityName?: string;
  entityId?: number;
}

const ActivityLogViewer: React.FC<ActivityLogViewerProps> = ({ entityName, entityId }) => {
  const [logs, setLogs] = useState<ActivityLogDto[]>([]);
  const [summary, setSummary] = useState<ActivityLogSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [usernames, setUsernames] = useState<string[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  // Filters
  const [filters, setFilters] = useState<ActivityLogFilterRequest>({
    webUserName: '',
    actionType: '',
    startDate: undefined,
    endDate: undefined,
    pageNumber: 1,
    pageSize: pageSize
  });

  useEffect(() => {
    loadLogs();
    loadSummary();
    loadUsernames();
  }, [currentPage]);

  const loadUsernames = async () => {
    try {
      const data = await getActivityLogUsernames();
      setUsernames(data);
    } catch (err) {
      console.error('Failed to load usernames:', err);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const filterRequest: ActivityLogFilterRequest = {
        ...filters,
        entityName,
        entityID: entityId,
        pageNumber: currentPage,
        pageSize: pageSize
      };

      const response = await getActivityLogs(filterRequest);
      setLogs(response.logs);
      setTotalPages(response.totalPages);
      setTotalCount(response.totalCount);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const summaryData = await getActivitySummary();
      setSummary(summaryData);
    } catch (err) {
      console.error('Failed to load summary:', err);
    }
  };

  const handleFilterChange = (field: keyof ActivityLogFilterRequest, value: string) => {
    if (field === 'startDate' || field === 'endDate') {
      setFilters(prev => ({ ...prev, [field]: value || undefined }));
    } else {
      setFilters(prev => ({ ...prev, [field]: value }));
    }
  };

  const applyFilters = () => {
    setCurrentPage(1);
    loadLogs();
  };

  const clearFilters = () => {
    setFilters({
      webUserName: '',
      actionType: '',
      startDate: undefined,
      endDate: undefined,
      pageNumber: 1,
      pageSize: pageSize
    });
    setCurrentPage(1);
    loadLogs();
  };

  const exportToCSV = () => {
    const headers = ['Date & Time', 'User Name', 'Action', 'Description', 'Status'];
    const rows = logs.map(log => [
      format(new Date(log.createdDate), 'yyyy-MM-dd HH:mm:ss'),
      log.webUserName,
      log.actionType,
      log.actionDescription,
      log.isSuccess ? 'Success' : 'Failed'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getActionColor = (actionType: string) => {
    switch (actionType.toLowerCase()) {
      case 'create': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
      case 'update': return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
      case 'delete': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      case 'view': return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800';
      case 'setup database': return 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20';
      case 'copy modules': return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20';
      default: return 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Activities</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.totalActivities}</p>
              </div>
              <Activity className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Today</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.todayActivities}</p>
              </div>
              <Clock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">This Week</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.thisWeekActivities}</p>
              </div>
              <Calendar className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Failed</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.failedActivities}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Activity Log
            <span className="text-sm font-normal text-gray-500">({totalCount} total)</span>
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
            <button
              onClick={loadLogs}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  User Name
                </label>
                <select
                  value={filters.webUserName}
                  onChange={(e) => handleFilterChange('webUserName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="">All Users</option>
                  {usernames.map((username) => (
                    <option key={username} value={username}>
                      {username}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Action Type
                </label>
                <select
                  value={filters.actionType}
                  onChange={(e) => handleFilterChange('actionType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="">All Actions</option>
                  <option value="View">View</option>
                  <option value="Create">Create</option>
                  <option value="Update">Update</option>
                  <option value="Delete">Delete</option>
                  <option value="Setup Database">Setup Database</option>
                  <option value="Copy Modules">Copy Modules</option>
                  <option value="Complete Setup">Complete Setup</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={applyFilters}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                <Search className="w-4 h-4" />
                Apply Filters
              </button>
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* Activity Timeline */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12 text-red-600">
              <AlertCircle className="w-6 h-6 mr-2" />
              {error}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No activity logs found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log, index) => (
                <div
                  key={log.activityLogID}
                  className="flex gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                >
                  {/* Timeline Dot */}
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getActionColor(log.actionType)}`}>
                      {log.isSuccess ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <AlertCircle className="w-5 h-5" />
                      )}
                    </div>
                    {index < logs.length - 1 && (
                      <div className="w-0.5 h-full bg-gray-200 dark:bg-gray-700 mt-2" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(log.actionType)}`}>
                            {log.actionType}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {log.webUserName}
                          </span>
                        </div>
                        <p className="text-sm text-gray-900 dark:text-white font-medium">
                          {log.actionDescription}
                        </p>
                        {log.errorMessage && (
                          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                            Error: {log.errorMessage}
                          </p>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(log.createdDate), 'MMM dd, yyyy HH:mm')}
                      </div>
                    </div>

                    {/* Old/New Values */}
                    {(log.oldValue || log.newValue) && (
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        {log.oldValue && (
                          <div className="p-2 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded">
                            <p className="font-medium text-red-800 dark:text-red-300 mb-1">Before:</p>
                            <pre className="text-red-600 dark:text-red-400 whitespace-pre-wrap break-all">
                              {JSON.stringify(JSON.parse(log.oldValue), null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.newValue && (
                          <div className="p-2 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded">
                            <p className="font-medium text-green-800 dark:text-green-300 mb-1">After:</p>
                            <pre className="text-green-600 dark:text-green-400 whitespace-pre-wrap break-all">
                              {JSON.stringify(JSON.parse(log.newValue), null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityLogViewer;
