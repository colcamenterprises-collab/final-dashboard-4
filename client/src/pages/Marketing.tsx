import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, CheckCircle, Circle, CalendarDays, Plus, Edit2, Trash2, Clock, AlertCircle, Filter, Search, Share2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { insertQuickNoteSchema, insertMarketingCalendarSchema, type QuickNote, type MarketingCalendar } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

const quickNoteFormSchema = insertQuickNoteSchema.extend({
  date: z.date()
});

const marketingCalendarFormSchema = insertMarketingCalendarSchema.extend({
  eventDate: z.date()
});

export default function Marketing() {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isQuickNoteDialogOpen, setIsQuickNoteDialogOpen] = useState(false);
  const [isCalendarDialogOpen, setIsCalendarDialogOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<QuickNote | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<MarketingCalendar | null>(null);
  const [selectedTab, setSelectedTab] = useState('quick-notes');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch quick notes
  const { data: quickNotes = [], isLoading: isLoadingNotes } = useQuery({
    queryKey: ['/api/quick-notes'],
    queryFn: async () => {
      const response = await fetch('/api/quick-notes');
      if (!response.ok) throw new Error('Failed to fetch quick notes');
      return response.json();
    }
  });

  // Fetch marketing calendar
  const { data: marketingCalendar = [], isLoading: isLoadingCalendar } = useQuery({
    queryKey: ['/api/marketing-calendar'],
    queryFn: async () => {
      const response = await fetch('/api/marketing-calendar');
      if (!response.ok) throw new Error('Failed to fetch marketing calendar');
      return response.json();
    }
  });

  // Quick note form
  const quickNoteForm = useForm<z.infer<typeof quickNoteFormSchema>>({
    resolver: zodResolver(quickNoteFormSchema),
    defaultValues: {
      content: '',
      priority: 'idea',
      date: new Date(),
      isCompleted: false
    }
  });

  // Marketing calendar form
  const marketingCalendarForm = useForm<z.infer<typeof marketingCalendarFormSchema>>({
    resolver: zodResolver(marketingCalendarFormSchema),
    defaultValues: {
      title: '',
      description: '',
      eventDate: new Date(),
      eventType: 'social_media',
      status: 'planned',
      googleCalendarId: null
    }
  });

  // Create quick note mutation
  const createQuickNoteMutation = useMutation({
    mutationFn: async (data: z.infer<typeof quickNoteFormSchema>) => {
      return apiRequest('/api/quick-notes', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quick-notes'] });
      setIsQuickNoteDialogOpen(false);
      quickNoteForm.reset();
      toast({
        title: "Success",
        description: "Quick note created successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create quick note",
        variant: "destructive"
      });
    }
  });

  // Update quick note mutation
  const updateQuickNoteMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<QuickNote> }) => {
      return apiRequest(`/api/quick-notes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quick-notes'] });
      toast({
        title: "Success",
        description: "Quick note updated successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update quick note",
        variant: "destructive"
      });
    }
  });

  // Delete quick note mutation
  const deleteQuickNoteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/quick-notes/${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quick-notes'] });
      toast({
        title: "Success",
        description: "Quick note deleted successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete quick note",
        variant: "destructive"
      });
    }
  });

  // Create marketing calendar event mutation
  const createMarketingCalendarMutation = useMutation({
    mutationFn: async (data: z.infer<typeof marketingCalendarFormSchema>) => {
      return apiRequest('/api/marketing-calendar', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing-calendar'] });
      setIsCalendarDialogOpen(false);
      marketingCalendarForm.reset();
      toast({
        title: "Success",
        description: "Marketing event created successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create marketing event",
        variant: "destructive"
      });
    }
  });

  // Update marketing calendar event mutation
  const updateMarketingCalendarMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<MarketingCalendar> }) => {
      return apiRequest(`/api/marketing-calendar/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing-calendar'] });
      toast({
        title: "Success",
        description: "Marketing event updated successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update marketing event",
        variant: "destructive"
      });
    }
  });

  // Delete marketing calendar event mutation
  const deleteMarketingCalendarMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/marketing-calendar/${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing-calendar'] });
      toast({
        title: "Success",
        description: "Marketing event deleted successfully"
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete marketing event",
        variant: "destructive"
      });
    }
  });

  // Toggle note completion
  const toggleNoteCompletion = (note: QuickNote) => {
    updateQuickNoteMutation.mutate({
      id: note.id,
      data: { isCompleted: !note.isCompleted }
    });
  };

  // Filter notes by priority
  const filteredNotes = quickNotes.filter((note: QuickNote) => {
    if (selectedFilter === 'all') return true;
    return note.priority === selectedFilter;
  }).filter((note: QuickNote) => {
    if (!searchQuery) return true;
    return note.content.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Filter events by search query
  const filteredEvents = marketingCalendar.filter((event: MarketingCalendar) => {
    if (!searchQuery) return true;
    return event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           event.description?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Handle quick note form submission
  const onQuickNoteSubmit = (data: z.infer<typeof quickNoteFormSchema>) => {
    if (selectedNote) {
      updateQuickNoteMutation.mutate({
        id: selectedNote.id,
        data: { ...data, updatedAt: new Date() }
      });
      setSelectedNote(null);
    } else {
      createQuickNoteMutation.mutate(data);
    }
    setIsQuickNoteDialogOpen(false);
  };

  // Handle marketing calendar form submission
  const onMarketingCalendarSubmit = (data: z.infer<typeof marketingCalendarFormSchema>) => {
    if (selectedEvent) {
      updateMarketingCalendarMutation.mutate({
        id: selectedEvent.id,
        data: { ...data, updatedAt: new Date() }
      });
      setSelectedEvent(null);
    } else {
      createMarketingCalendarMutation.mutate(data);
    }
    setIsCalendarDialogOpen(false);
  };

  // Handle edit note
  const handleEditNote = (note: QuickNote) => {
    setSelectedNote(note);
    quickNoteForm.reset({
      content: note.content,
      priority: note.priority,
      date: new Date(note.date),
      isCompleted: note.isCompleted || false
    });
    setIsQuickNoteDialogOpen(true);
  };

  // Handle edit event
  const handleEditEvent = (event: MarketingCalendar) => {
    setSelectedEvent(event);
    marketingCalendarForm.reset({
      title: event.title,
      description: event.description || '',
      eventDate: new Date(event.eventDate),
      eventType: event.eventType,
      status: event.status,
      googleCalendarId: event.googleCalendarId
    });
    setIsCalendarDialogOpen(true);
  };

  // Reset forms when dialogs close
  useEffect(() => {
    if (!isQuickNoteDialogOpen) {
      setSelectedNote(null);
      quickNoteForm.reset();
    }
  }, [isQuickNoteDialogOpen]);

  useEffect(() => {
    if (!isCalendarDialogOpen) {
      setSelectedEvent(null);
      marketingCalendarForm.reset();
    }
  }, [isCalendarDialogOpen]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'idea': return 'bg-blue-100 text-blue-800';
      case 'note only': return 'bg-gray-100 text-gray-800';
      case 'implement': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatEventType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Marketing</h1>
          <p className="text-gray-600">Manage marketing tasks and calendar events</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setIsQuickNoteDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Quick Note
          </Button>
          <Button
            onClick={() => setIsCalendarDialogOpen(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            <Calendar className="w-4 h-4 mr-2" />
            New Event
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search notes and events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <Select value={selectedFilter} onValueChange={setSelectedFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="idea">Ideas</SelectItem>
              <SelectItem value="note only">Notes</SelectItem>
              <SelectItem value="implement">Implement</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="quick-notes">Quick Notes</TabsTrigger>
          <TabsTrigger value="calendar">Marketing Calendar</TabsTrigger>
        </TabsList>

        {/* Quick Notes Tab */}
        <TabsContent value="quick-notes" className="space-y-4">
          {isLoadingNotes ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredNotes.map((note: QuickNote) => (
                <Card key={note.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <button
                          onClick={() => toggleNoteCompletion(note)}
                          className="mt-1 text-gray-400 hover:text-green-600 transition-colors"
                        >
                          {note.isCompleted ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <Circle className="w-5 h-5" />
                          )}
                        </button>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={getPriorityColor(note.priority)}>
                              {note.priority}
                            </Badge>
                            <span className="text-sm text-gray-500">
                              {new Date(note.date).toLocaleDateString('en-GB')}
                            </span>
                          </div>
                          <p className={`text-gray-900 ${note.isCompleted ? 'line-through opacity-60' : ''}`}>
                            {note.content}
                          </p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            Created: {new Date(note.createdAt).toLocaleDateString('en-GB')}
                            {note.updatedAt && note.updatedAt !== note.createdAt && (
                              <span>• Updated: {new Date(note.updatedAt).toLocaleDateString('en-GB')}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditNote(note)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteQuickNoteMutation.mutate(note.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredNotes.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No quick notes found</p>
                  <p className="text-sm">Create your first quick note to get started</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Marketing Calendar Tab */}
        <TabsContent value="calendar" className="space-y-4">
          {isLoadingCalendar ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredEvents.map((event: MarketingCalendar) => (
                <Card key={event.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getStatusColor(event.status)}>
                            {event.status.replace('_', ' ')}
                          </Badge>
                          <Badge variant="outline">
                            {formatEventType(event.eventType)}
                          </Badge>
                          <span className="text-sm text-gray-500">
                            {new Date(event.eventDate).toLocaleDateString('en-GB')}
                          </span>
                        </div>
                        <h3 className="font-semibold text-gray-900 mb-1">{event.title}</h3>
                        {event.description && (
                          <p className="text-gray-600 text-sm mb-2">{event.description}</p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          Created: {new Date(event.createdAt).toLocaleDateString('en-GB')}
                          {event.updatedAt && event.updatedAt !== event.createdAt && (
                            <span>• Updated: {new Date(event.updatedAt).toLocaleDateString('en-GB')}</span>
                          )}
                          {event.googleCalendarId && (
                            <span className="flex items-center gap-1 text-blue-600">
                              <Share2 className="w-3 h-3" />
                              Google Calendar
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditEvent(event)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteMarketingCalendarMutation.mutate(event.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredEvents.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <CalendarDays className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No marketing events found</p>
                  <p className="text-sm">Create your first marketing event to get started</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Quick Note Dialog */}
      <Dialog open={isQuickNoteDialogOpen} onOpenChange={setIsQuickNoteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {selectedNote ? 'Edit Quick Note' : 'Create Quick Note'}
            </DialogTitle>
            <DialogDescription>
              {selectedNote ? 'Update your quick note' : 'Add a new quick note for marketing tasks'}
            </DialogDescription>
          </DialogHeader>
          <Form {...quickNoteForm}>
            <form onSubmit={quickNoteForm.handleSubmit(onQuickNoteSubmit)} className="space-y-4">
              <FormField
                control={quickNoteForm.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter your note content..."
                        {...field}
                        rows={4}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={quickNoteForm.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="idea">Idea</SelectItem>
                        <SelectItem value="note only">Note Only</SelectItem>
                        <SelectItem value="implement">Implement</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={quickNoteForm.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={field.value?.toISOString().split('T')[0] || ''}
                        onChange={(e) => field.onChange(new Date(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsQuickNoteDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createQuickNoteMutation.isPending || updateQuickNoteMutation.isPending}
                >
                  {selectedNote ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Marketing Calendar Dialog */}
      <Dialog open={isCalendarDialogOpen} onOpenChange={setIsCalendarDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {selectedEvent ? 'Edit Marketing Event' : 'Create Marketing Event'}
            </DialogTitle>
            <DialogDescription>
              {selectedEvent ? 'Update your marketing event' : 'Add a new marketing event to your calendar'}
            </DialogDescription>
          </DialogHeader>
          <Form {...marketingCalendarForm}>
            <form onSubmit={marketingCalendarForm.handleSubmit(onMarketingCalendarSubmit)} className="space-y-4">
              <FormField
                control={marketingCalendarForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Event title..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={marketingCalendarForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Event description..."
                        {...field}
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={marketingCalendarForm.control}
                  name="eventType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="social_media">Social Media</SelectItem>
                          <SelectItem value="email_campaign">Email Campaign</SelectItem>
                          <SelectItem value="promotion">Promotion</SelectItem>
                          <SelectItem value="content_creation">Content Creation</SelectItem>
                          <SelectItem value="advertising">Advertising</SelectItem>
                          <SelectItem value="partnership">Partnership</SelectItem>
                          <SelectItem value="event">Event</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={marketingCalendarForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="planned">Planned</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={marketingCalendarForm.control}
                name="eventDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={field.value?.toISOString().split('T')[0] || ''}
                        onChange={(e) => field.onChange(new Date(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Share2 className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Google Calendar Integration</span>
                </div>
                <p className="text-sm text-blue-700">
                  Google Calendar sync is ready for setup. Events will be automatically synchronized once configured.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCalendarDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMarketingCalendarMutation.isPending || updateMarketingCalendarMutation.isPending}
                >
                  {selectedEvent ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}