from django.urls import path

from .views import (
    RegisterView,
    LoginView,
    CurrentUserView,
    LogoutView,
    PostListCreateView,
    LikeToggleView,
    SaveToggleView,
    CommentListCreateView,
    ShareCreateView,
    UserProfileView,
    UserPostsView, 
    UserSharesView , 
    MySavedPostsView,
    MyLikedPostsView,
    MyCommentedPostsView,
    MySharedPostsView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("me/", CurrentUserView.as_view(), name="current-user"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("posts/", PostListCreateView.as_view(), name="posts"),
    path("posts/<int:post_id>/like/", LikeToggleView.as_view(), name="post-like"),
    path("posts/<int:post_id>/save/", SaveToggleView.as_view(), name="post-save"),
    path("posts/<int:post_id>/comments/", CommentListCreateView.as_view(), name="post-comments"),
    path("posts/<int:post_id>/share/", ShareCreateView.as_view(), name="post-share"),
    path("profile/<str:username>/", UserProfileView.as_view(), name="user-profile"),
    path("profile/<str:username>/posts/", UserPostsView.as_view(), name="user-posts"),
    path("profile/<str:username>/shares/", UserSharesView.as_view(), name="user-shares"),
    path("me/saved/", MySavedPostsView.as_view(), name="my-saved"),
    path("me/liked/", MyLikedPostsView.as_view(), name="my-liked"),
    path("me/commented/", MyCommentedPostsView.as_view(), name="my-commented"),
    path("me/shared/", MySharedPostsView.as_view(), name="my-shared"),


]
