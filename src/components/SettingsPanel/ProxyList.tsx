/**
 * @file Proxy management component with optimized table, pagination and proxy selection.
 * @description Unified component for managing proxy servers with pagination for performance. Includes import, test all proxies, and export buttons. Displays proxies in structured table with columns Select, Type, IP Address, Port, Auth, Status and Actions. Supports working with thousands of proxies through pagination of 50 items per page. Features persistent test results via composite keys and manual proxy selection via radio buttons.
 */
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Globe,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import React, { useState } from 'react'

import { getProxyKey } from '../../shared/store/proxyListStore'
import type { ProxyItem, ProxyTestResult } from '../../shared/types/account'
import { Badge } from '../../shared/ui/badge'
import { Button } from '../../shared/ui/button'
import { Card, CardContent } from '../../shared/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../shared/ui/table'
import { Tooltip } from '../../shared/ui/tooltip'

interface ProxyListProps {
  proxies: ProxyItem[]
  testResults: Record<string, ProxyTestResult>
  isTesting: Record<number, boolean>
  isTestingAll: boolean
  selectedProxyIndex: number | null
  handleTestProxy: (index: number) => Promise<void>
  handleDeleteProxy: (index: number) => void
  handleSelectProxy: (index: number | null) => void
  // List Management functions
  showImport: boolean
  setShowImport: (value: boolean) => void
  handleTestAllProxies: () => Promise<void>
  handleStopTestAll: () => void
  handleDeleteInvalidProxies: () => Promise<void>
  handleExport: () => void
  clearAllProxies: () => void
  isLoading: boolean
  // Test progress
  testProgress?: {
    total: number
    tested: number
    valid: number
    invalid: number
    startTime: number
  } | null
}

/**
 * Compact progress bar component for test all operation
 */
const TestProgressBar: React.FC<{
  testProgress: {
    total: number
    tested: number
    valid: number
    invalid: number
    startTime: number
  }
}> = ({ testProgress }) => {
  const { total, tested, valid, invalid, startTime } = testProgress
  const remaining = total - tested
  const elapsed = (Date.now() - startTime) / 1000
  const speed = elapsed > 0 ? Math.round(tested / elapsed) : 0
  const progress = total > 0 ? Math.round((tested / total) * 100) : 0

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/30 rounded-md border border-border text-[10px] font-medium">
      <span className="text-muted-foreground">Testing:</span>
      <span className="text-foreground">
        {tested}/{total}
      </span>
      <div className="h-3 w-px bg-border" />
      <span className="text-green-600 dark:text-green-400">{valid} OK</span>
      <div className="h-3 w-px bg-border" />
      <span className="text-red-600 dark:text-red-400">{invalid} Fail</span>
      <div className="h-3 w-px bg-border" />
      <span className="text-muted-foreground">Left: {remaining}</span>
      <div className="h-3 w-px bg-border" />
      <span className="text-muted-foreground">{speed}/s</span>
      <div className="h-3 w-px bg-border" />
      <span className="text-blue-600 dark:text-blue-400">{progress}%</span>
    </div>
  )
}

/**
 * Component for displaying and managing the proxy list
 */
export const ProxyList: React.FC<ProxyListProps> = ({
  proxies,
  testResults,
  isTesting,
  isTestingAll,
  selectedProxyIndex,
  handleTestProxy,
  handleDeleteProxy,
  handleSelectProxy,
  showImport,
  setShowImport,
  handleTestAllProxies,
  handleStopTestAll,
  handleDeleteInvalidProxies,
  handleExport,
  clearAllProxies,
  isLoading,
  testProgress,
}) => {
  const ITEMS_PER_PAGE = 50
  const [currentPage, setCurrentPage] = useState(1)

  const totalPages = Math.ceil(proxies.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const currentProxies = proxies.slice(startIndex, endIndex)

  return (
    <Card className="flex-1 min-h-0 border-border bg-card shadow-lg">
      <CardContent className="p-0 h-full">
        <div className="h-full overflow-hidden">
          <div className="px-3 md:px-4 lg:px-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-medium flex items-center gap-2">
                <Globe size={20} className="text-purple-500" />
                <span className="bg-linear-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent font-semibold">
                  Proxy Management ({proxies.length})
                </span>
              </h4>
              {totalPages > 1 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    Page {currentPage} of {totalPages}
                  </span>
                </div>
              )}
            </div>

            {/* Management Buttons */}
            <div className="flex gap-2 mb-2">
              <Tooltip content="Import proxies from text or file">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowImport(!showImport)}
                  className="flex-1 gap-1.5 h-8 text-xs border-purple-200 hover:bg-purple-50 hover:text-purple-700 dark:border-purple-800 dark:hover:bg-purple-900/20 dark:hover:text-purple-300"
                >
                  <Upload size={12} />
                  Import
                </Button>
              </Tooltip>

              <Tooltip
                content={
                  isTestingAll ? 'Stop testing all proxies' : 'Test connectivity of all proxies'
                }
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (isTestingAll) {
                      handleStopTestAll()
                    } else {
                      void handleTestAllProxies()
                    }
                  }}
                  disabled={isLoading || proxies.length === 0}
                  className={`flex-1 gap-1.5 h-8 text-xs ${
                    isTestingAll
                      ? 'border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:hover:bg-red-900/20 dark:hover:text-red-300'
                      : 'border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-800 dark:hover:bg-blue-900/20 dark:hover:text-blue-300'
                  }`}
                >
                  <RefreshCw size={12} className={isTestingAll ? 'animate-spin' : ''} />
                  {isTestingAll ? 'Stop' : 'Test All'}
                </Button>
              </Tooltip>

              <Tooltip content="Delete all proxies that failed testing">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void handleDeleteInvalidProxies()
                  }}
                  disabled={
                    proxies.length === 0 || Object.values(isTesting).some(testing => testing)
                  }
                  className="flex-1 gap-1.5 h-8 text-xs border-orange-200 hover:bg-orange-50 hover:text-orange-700 dark:border-orange-800 dark:hover:bg-orange-900/20 dark:hover:text-orange-300"
                >
                  <X size={12} />
                  Delete Invalid
                </Button>
              </Tooltip>

              <Tooltip content="Export proxy list to file">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={proxies.length === 0}
                  className="flex-1 gap-1.5 h-8 text-xs border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-800 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-300"
                >
                  <Download size={12} />
                  Export
                </Button>
              </Tooltip>
              <Tooltip content="Clear all proxies">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearAllProxies}
                  disabled={proxies.length === 0}
                  className="flex-1 gap-1.5 h-8 text-xs border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:hover:bg-red-900/20 dark:hover:text-red-300"
                >
                  <Trash2 size={12} />
                  Clear All
                </Button>
              </Tooltip>
            </div>

            {/* Test Progress Bar */}
            {testProgress && (
              <div className="mb-2">
                <TestProgressBar testProgress={testProgress} />
              </div>
            )}

            <div className="overflow-auto max-h-96 border rounded-md scrollbar-thin scrollbar-thumb-muted scrollbar-track-background">
              <Table className="text-xs">
                <TableHeader className="bg-muted/30 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="h-8 px-2 w-8">
                      <Tooltip content="Select proxy for exclusive use (clear to use rotation)">
                        <span className="cursor-help">Use</span>
                      </Tooltip>
                    </TableHead>
                    <TableHead className="h-8 px-2">Type</TableHead>
                    <TableHead className="h-8 px-2">IP Address</TableHead>
                    <TableHead className="h-8 px-2">Port</TableHead>
                    <TableHead className="h-8 px-2">Auth</TableHead>
                    <TableHead className="h-8 px-2">Status</TableHead>
                    <TableHead className="h-8 px-2 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proxies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center">
                        <div className="text-center text-muted-foreground">
                          <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
                          <p className="font-medium mb-1">No proxies configured</p>
                          <p className="text-xs">
                            Add a proxy above or import a list to get started
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentProxies.map((proxy, index) => {
                      const originalIndex = startIndex + index
                      const proxyKey = getProxyKey(proxy)
                      const testResult = testResults[proxyKey]
                      const isSelected = selectedProxyIndex === originalIndex

                      return (
                        <TableRow
                          key={`proxy-${originalIndex}-${proxyKey}`}
                          className="h-8 hover:bg-muted/20"
                        >
                          <TableCell className="p-2">
                            <Tooltip
                              content={
                                isSelected
                                  ? 'Click to use rotation'
                                  : 'Click to use only this proxy'
                              }
                            >
                              <input
                                type="radio"
                                checked={isSelected}
                                onChange={() =>
                                  handleSelectProxy(isSelected ? null : originalIndex)
                                }
                                className="cursor-pointer w-3 h-3"
                              />
                            </Tooltip>
                          </TableCell>
                          <TableCell className="p-2">
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1 py-0 h-4 min-w-0"
                            >
                              {proxy.type?.toUpperCase() ?? 'SOCKS5'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs font-medium p-2 max-w-32 truncate">
                            {proxy.host}
                          </TableCell>
                          <TableCell className="font-mono text-xs p-2">{proxy.port}</TableCell>
                          <TableCell className="p-2">
                            {(proxy.username?.length ?? 0) > 0 ? (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                Yes
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-[10px]">No</span>
                            )}
                          </TableCell>
                          <TableCell className="p-2">
                            <div className="flex items-center gap-1">
                              {testResult?.loading ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 h-4 animate-pulse"
                                >
                                  Testing...
                                </Badge>
                              ) : testResult?.success === true ? (
                                <Tooltip content={`Working | IP: ${testResult.ip || 'N/A'}`}>
                                  <Badge
                                    variant="default"
                                    className="text-[10px] px-1.5 py-0 h-4 bg-green-500 hover:bg-green-600 cursor-help font-mono"
                                  >
                                    {testResult.responseTime ?? '-'}ms
                                  </Badge>
                                </Tooltip>
                              ) : testResult?.success === false ? (
                                <Tooltip content={`Failed: ${testResult.error || 'Unknown'}`}>
                                  <Badge
                                    variant="destructive"
                                    className="text-[10px] px-1.5 py-0 h-4 cursor-help"
                                  >
                                    Error
                                  </Badge>
                                </Tooltip>
                              ) : (
                                <span className="text-muted-foreground text-[10px]">
                                  Not tested
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right p-2">
                            <div className="flex items-center gap-0.5 justify-end">
                              <Tooltip content="Test proxy">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => void handleTestProxy(originalIndex)}
                                  disabled={isTesting[originalIndex]}
                                  className="h-6 w-6 p-0"
                                >
                                  <RefreshCw
                                    size={10}
                                    className={isTesting[originalIndex] ? 'animate-spin' : ''}
                                  />
                                </Button>
                              </Tooltip>
                              <Tooltip content="Delete proxy">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteProxy(originalIndex)}
                                  className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 size={10} />
                                </Button>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-3 border-t bg-muted/10 h-component-lg">
                <div className="text-xs text-muted-foreground">
                  Showing {startIndex + 1}-{Math.min(endIndex, proxies.length)} of {proxies.length}{' '}
                  proxies
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="h-7 w-7 p-0"
                  >
                    <ChevronLeft size={12} />
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(
                        page =>
                          page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1
                      )
                      .map((page, index, array) => (
                        <React.Fragment key={page}>
                          {index > 0 && array[index - 1] !== page - 1 && (
                            <span className="text-xs text-muted-foreground px-1">...</span>
                          )}
                          <Button
                            variant={page === currentPage ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="h-7 w-7 p-0 text-xs"
                          >
                            {page}
                          </Button>
                        </React.Fragment>
                      ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="h-7 w-7 p-0"
                  >
                    <ChevronRight size={12} />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default ProxyList
