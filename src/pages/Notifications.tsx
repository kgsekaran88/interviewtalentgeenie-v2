import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logger } from '@/lib/logger';
import { AppNavbar } from "@/components/AppNavbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Info,
  UserPlus,
  FileCheck,
  Shield,
  Trash2,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
  metadata: any;
}

const Notifications = () => {
  const navigate = useNavigate();
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }
    setUser(user);
    fetchNotifications(user.id);
    subscribeToNotifications(user.id);
  };

  const fetchNotifications = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setNotifications(data);
      }
    } catch (error) {
      logger.error('Error fetching notifications:', error);
      toast({
        title: 'Error',
        description: 'Failed to load notifications',
        variant: 'destructive',
      });
    }
  };

  const subscribeToNotifications = (userId: string) => {
    const channel = supabase
      .channel('notifications-page-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          setNotifications(prev =>
            prev.map(n => n.id === payload.new.id ? payload.new as Notification : n)
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to mark notification as read",
        variant: "destructive",
      });
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to mark all as read",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "All notifications marked as read",
      });
    }
  };

  const deleteNotification = async (notificationId: string) => {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete notification",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Notification deleted",
      });
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'candidate_submission':
        return <UserPlus className="w-5 h-5 text-primary" />;
      case 'interview_status':
        return <FileCheck className="w-5 h-5 text-success" />;
      case 'proctoring_alert':
        return <Shield className="w-5 h-5 text-destructive" />;
      case 'report_ready':
        return <CheckCircle2 className="w-5 h-5 text-accent" />;
      case 'system_alert':
        return <AlertCircle className="w-5 h-5 text-warning" />;
      default:
        return <Info className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.is_read)
    : notifications;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-4xl">
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Bell className="w-5 h-5 sm:w-6 sm:h-6" />
                  Notifications
                  {unreadCount > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {unreadCount} new
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="mt-2 text-xs sm:text-sm">
                  Stay updated with interview status, candidate submissions, and system alerts
                </CardDescription>
              </div>
              {unreadCount > 0 && (
                <Button onClick={markAllAsRead} variant="outline" size="sm" className="self-start sm:self-auto min-h-[40px]">
                  <Check className="w-4 h-4 mr-2" />
                  Mark all read
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread')}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="all" className="text-xs sm:text-sm min-h-[40px]">
                  All ({notifications.length})
                </TabsTrigger>
                <TabsTrigger value="unread" className="text-xs sm:text-sm min-h-[40px]">
                  Unread ({unreadCount})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value={filter} className="space-y-2">
                {filteredNotifications.length === 0 ? (
                  <div className="py-8 sm:py-12 text-center">
                    <Bell className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-sm sm:text-base text-muted-foreground">
                      {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                      You'll see updates about interviews, candidates, and system alerts here
                    </p>
                  </div>
                ) : (
                  filteredNotifications.map((notification) => (
                    <Card
                      key={notification.id}
                      className={cn(
                        "transition-all duration-200 hover:shadow-md cursor-pointer",
                        !notification.is_read && "bg-primary/5 border-primary/20"
                      )}
                    >
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex gap-3 sm:gap-4">
                          <div className="flex-shrink-0 mt-0.5 sm:mt-1">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0" onClick={() => handleNotificationClick(notification)}>
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <h4 className={cn(
                                "font-medium text-sm sm:text-base",
                                !notification.is_read && "text-foreground",
                                notification.is_read && "text-muted-foreground"
                              )}>
                                {notification.title}
                              </h4>
                              <div className="flex items-center gap-2">
                                {!notification.is_read && (
                                  <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                                )}
                              </div>
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground mb-2 line-clamp-2">
                              {notification.message}
                            </p>
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                              </p>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNotification(notification.id);
                                }}
                                className="text-destructive hover:text-destructive h-8 w-8 p-0 min-h-[32px] min-w-[32px]"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Notifications;