package main

import (
	"net/http"
	"os"
	"time"
	"fmt"
	"runtime"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/mem"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type User struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	Username string `gorm:"unique;not null" json:"username"`
	Password string `gorm:"not null" json:"-"`
}

var db *gorm.DB
var jwtKey []byte

func main() {
	// Load JWT Secret
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "default_fallback_secret_change_me"
	}
	jwtKey = []byte(secret)

	// Database connection
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=db user=postgres password=postgres dbname=postgres port=5432 sslmode=disable"
	}

	var err error
	for i := 0; i < 5; i++ {
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
		if err == nil {
			break
		}
		time.Sleep(5 * time.Second)
	}

	if err != nil {
		panic("failed to connect database")
	}

	db.AutoMigrate(&User{})

	r := gin.Default()

	// CORS
	r.Use(cors.New(cors.Config{
		AllowOriginFunc: func(origin string) bool {
			return true // Allow all origins dynamically
		},
		AllowMethods:     []string{"POST", "GET", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	api := r.Group("/api")
	{
		api.POST("/register", register)
		api.POST("/login", login)
		api.POST("/logout", logout)
	}

	protected := r.Group("/api")
	protected.Use(authMiddleware())
	{
		protected.GET("/system-stats", getSystemStats)
	}

	r.Run(":8080")
}

func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString, err := c.Cookie("token")
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return jwtKey, nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		c.Next()
	}
}

func register(c *gin.Context) {
	var input struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	user := User{Username: input.Username, Password: string(hashedPassword)}

	if err := db.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not create user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Registration successful"})
}

func login(c *gin.Context) {
	var input struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user User
	if err := db.Where("username = ?", input.Username).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username or password"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username or password"})
		return
	}

			token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
				"user_id": user.ID,
				"exp":     time.Now().Add(time.Hour * 72).Unix(),
			})
	tokenString, _ := token.SignedString(jwtKey)

	// Set HttpOnly Cookie
	// Name, Value, MaxAge, Path, Domain, Secure, HttpOnly
	c.SetCookie("token", tokenString, 3600*72, "/", "", false, true) // Secure=false for localhost testing

	c.JSON(http.StatusOK, gin.H{"message": "Login successful"})
}

func logout(c *gin.Context) {
	// Clear the cookie by setting max age to -1
	c.SetCookie("token", "", -1, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"message": "Logout successful"})
}

func getSystemStats(c *gin.Context) {
	// 1. Backend Resources
	v, _ := mem.VirtualMemory()
	cPercentages, _ := cpu.Percent(0, false)
	cpuPercent := 0.0
	if len(cPercentages) > 0 {
		cpuPercent = cPercentages[0]
	}

	// Go Runtime Stats
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	// 2. Database Stats
	sqlDB, err := db.DB()
	dbStats := make(map[string]interface{})
	if err == nil {
		stats := sqlDB.Stats()
		dbStats["open_connections"] = stats.OpenConnections
		dbStats["in_use"] = stats.InUse
		dbStats["idle"] = stats.Idle
		
		// Query DB Version as a ping check
		var version string
		db.Raw("SELECT version()").Scan(&version)
		dbStats["version"] = version
		dbStats["status"] = "connected"
	} else {
		dbStats["status"] = "disconnected"
		dbStats["error"] = err.Error()
	}

	c.JSON(http.StatusOK, gin.H{
		"backend": gin.H{
			"cpu_percent":   cpuPercent,
			"memory_total_mb": v.Total / 1024 / 1024,
			"memory_used_mb":  v.Used / 1024 / 1024,
			"memory_percent": v.UsedPercent,
			"goroutines":    runtime.NumGoroutine(),
			"go_alloc_mb":   m.Alloc / 1024 / 1024,
		},
		"database": dbStats,
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

